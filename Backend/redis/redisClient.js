/**
 * Centralized Redis Client & Message Broker Layer
 * Supports multi-instance Redis Pub/Sub with resilient in-memory fallback.
 * Guarantees zero application crashes if Redis is temporarily offline,
 * and automatically resumes Redis-based distribution when Redis is online.
 */

const Redis = require('ioredis');
const EventEmitter = require('events');

require('dotenv').config();

const rawRedisUrl = process.env.REDIS_URL || process.env.REDIS_CACHE_URL;
let REDIS_URL = null;
if (rawRedisUrl) {
  const match = rawRedisUrl.match(/(rediss?:\/\/[^\s'"]+)/);
  REDIS_URL = match ? match[1] : rawRedisUrl.trim();
}

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// In-memory fallback event bus
const fallbackBus = new EventEmitter();
fallbackBus.setMaxListeners(200);

let isRedisAvailable = false;
let reconnectAttempts = 0;
const MAX_SILENT_RETRIES = 3;

// Configure base Redis client options
const baseRedisOptions = {
  retryStrategy(times) {
    reconnectAttempts = times;
    // Exponential backoff with a cap at 10 seconds
    const delay = Math.min(times * 1000, 10000);
    return delay;
  },
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true, // Connect manually to handle errors gracefully
  connectTimeout: 5000
};

// Create client instances
let pubClient = null;
let subClient = null;
let cacheClient = null;

// Active channel subscriptions for resubscribing upon reconnect
const channelSubscriptions = new Map(); // channel -> Set<callback>

// Fallback in-memory cache
const memoryCache = new Map(); // key -> { value, expiresAt }

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}, 30000);

function createRedisInstance(role) {
  let client;
  if (REDIS_URL) {
    client = new Redis(REDIS_URL, {
      ...baseRedisOptions,
      connectionName: `subadmin-${role}`
    });
  } else {
    client = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      ...baseRedisOptions,
      connectionName: `subadmin-${role}`
    });
  }

  client.on('connect', () => {
    isRedisAvailable = true;
    reconnectAttempts = 0;
    const targetHost = client.options?.host || REDIS_HOST;
    const targetPort = client.options?.port || REDIS_PORT;
    console.log(`📡 [Redis] Successfully connected to Redis (${role}) at ${targetHost}:${targetPort}`);
  });

  client.on('error', (err) => {
    if (reconnectAttempts <= MAX_SILENT_RETRIES) {
      console.warn(`⚠️ [Redis] Connection notice (${role}): ${err.message}. Operating in resilient fallback mode.`);
    }
    isRedisAvailable = false;
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  return client;
}

/**
 * Initialize Redis connections
 */
async function initRedis() {
  try {
    pubClient = createRedisInstance('publisher');
    subClient = createRedisInstance('subscriber');
    cacheClient = createRedisInstance('cache');

    subClient.on('message', (channel, message) => {
      const handlers = channelSubscriptions.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message, channel);
          } catch (e) {
            console.error(`[Redis] Subscriber handler error for ${channel}:`, e.message);
          }
        });
      }
    });

    subClient.on('ready', () => {
      // Re-subscribe to all registered channels after reconnect
      for (const channel of channelSubscriptions.keys()) {
        subClient.subscribe(channel).catch(err => {
          console.warn(`[Redis] Resubscribe error on ${channel}:`, err.message);
        });
      }
    });

    // Attempt connecting asynchronously
    await Promise.allSettled([
      pubClient.connect(),
      subClient.connect(),
      cacheClient.connect()
    ]);
  } catch (err) {
    console.warn('⚠️ [Redis] Initial connection unavailable. System is running with resilient local message broker.');
  }
}

/**
 * Publish message to a channel across Redis cluster/instances
 */
async function publish(channel, message) {
  const serialized = typeof message === 'string' ? message : JSON.stringify(message);

  // Always deliver to local in-process fallback bus so local subscribers get instant delivery
  fallbackBus.emit(channel, serialized);

  // If Redis is active, publish to Redis to reach other backend instances
  if (isRedisAvailable && pubClient && pubClient.status === 'ready') {
    try {
      await pubClient.publish(channel, serialized);
    } catch (err) {
      console.warn(`[Redis] Publish to ${channel} failed, using local bus:`, err.message);
    }
  }
}

/**
 * Subscribe to a channel
 */
function subscribe(channel, handler) {
  if (!channelSubscriptions.has(channel)) {
    channelSubscriptions.set(channel, new Set());
    if (isRedisAvailable && subClient && subClient.status === 'ready') {
      subClient.subscribe(channel).catch(err => {
        console.warn(`[Redis] Subscribe error for ${channel}:`, err.message);
      });
    }
  }

  channelSubscriptions.get(channel).add(handler);

  // Also hook into local in-process fallback bus
  const localWrapper = (msg) => {
    // If Redis is active, skip local fallback to avoid duplicate delivery from both local bus and Redis sub
    if (!isRedisAvailable) {
      try {
        handler(msg, channel);
      } catch (err) {
        console.error(`[LocalBus] Handler error on ${channel}:`, err.message);
      }
    }
  };

  fallbackBus.on(channel, localWrapper);

  // Return unsubscribe function
  return () => {
    const handlers = channelSubscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        channelSubscriptions.delete(channel);
        if (isRedisAvailable && subClient && subClient.status === 'ready') {
          subClient.unsubscribe(channel).catch(() => {});
        }
      }
    }
    fallbackBus.off(channel, localWrapper);
  };
}

/**
 * Cache Operations with Redis + In-Memory Fallback
 */
async function cacheGet(key) {
  if (isRedisAvailable && cacheClient && cacheClient.status === 'ready') {
    try {
      const data = await cacheClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      // Fall through to memoryCache
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    if (cached.expiresAt && cached.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return cached.value;
  }
  return null;
}

async function cacheSet(key, value, ttlSeconds = 300) {
  const serialized = JSON.stringify(value);
  if (isRedisAvailable && cacheClient && cacheClient.status === 'ready') {
    try {
      if (ttlSeconds > 0) {
        await cacheClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await cacheClient.set(key, serialized);
      }
    } catch (err) {
      // Fall through to memoryCache
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null
  });
}

async function cacheDel(key) {
  if (isRedisAvailable && cacheClient && cacheClient.status === 'ready') {
    try {
      await cacheClient.del(key);
    } catch (err) {}
  }
  memoryCache.delete(key);
}

async function cacheDelPattern(pattern) {
  if (isRedisAvailable && cacheClient && cacheClient.status === 'ready') {
    try {
      const keys = await cacheClient.keys(pattern);
      if (keys && keys.length > 0) {
        await cacheClient.del(...keys);
      }
    } catch (err) {}
  }

  // Memory cache pattern match
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

function getRedisStatus() {
  return {
    mode: isRedisAvailable ? 'redis' : 'resilient_local_bus',
    connected: isRedisAvailable,
    reconnectAttempts,
    host: REDIS_HOST,
    port: REDIS_PORT,
    activeChannels: Array.from(channelSubscriptions.keys()),
    cachedKeysCount: memoryCache.size
  };
}

module.exports = {
  initRedis,
  publish,
  subscribe,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  getRedisStatus,
  isRedisConnected: () => isRedisAvailable
};
