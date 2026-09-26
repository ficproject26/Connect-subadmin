/**
 * Centralized Event Subscriber
 * Listens to Redis Pub/Sub events and fans them out to WebSocket server and local listeners.
 * Implements deduplication and event routing.
 */

const { subscribe } = require('../redis/redisClient');
const { SYSTEM_EVENTS_CHANNEL } = require('./eventStandards');

// Deduplication for incoming subscribed events across multi-instance Redis
const processedEventIds = new Set();
const MAX_PROCESSED_TRACK = 1000;

// Local entity listener callbacks: Map<entityName, Set<callback>>
const entityListeners = new Map();

// WebSocket broadcaster hook (injected by websocketServer on startup)
let wsBroadcaster = null;

// Telemetry
const subscriberMetrics = {
  totalReceived: 0,
  totalForwardedToWs: 0,
  lastReceivedAt: null
};

function handleIncomingMessage(rawMessage) {
  try {
    const event = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    if (!event || !event.id) return;

    // Deduplicate against already processed events
    if (processedEventIds.has(event.id)) {
      return;
    }
    processedEventIds.add(event.id);

    // Keep set bounded
    if (processedEventIds.size > MAX_PROCESSED_TRACK) {
      const first = processedEventIds.values().next().value;
      processedEventIds.delete(first);
    }

    subscriberMetrics.totalReceived++;
    subscriberMetrics.lastReceivedAt = new Date().toISOString();

    // 1. Forward event to active WebSocket connections
    if (wsBroadcaster) {
      wsBroadcaster(event);
      subscriberMetrics.totalForwardedToWs++;
    }

    // 2. Dispatch to internal entity listeners
    const cleanEntity = (event.entity || '').toLowerCase();
    const handlers = entityListeners.get(cleanEntity);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(event);
        } catch (e) {
          console.error(`[EventSubscriber] Error in listener for ${cleanEntity}:`, e.message);
        }
      });
    }

    // Also dispatch to wildcard listeners
    const wildcard = entityListeners.get('*');
    if (wildcard) {
      wildcard.forEach(fn => {
        try {
          fn(event);
        } catch (e) {
          console.error(`[EventSubscriber] Error in wildcard listener:`, e.message);
        }
      });
    }
  } catch (err) {
    console.error('[EventSubscriber] Failed to parse message:', err.message);
  }
}

/**
 * Initialize event subscription
 */
function initEventSubscriber(broadcaster = null) {
  if (broadcaster) {
    wsBroadcaster = broadcaster;
  }
  subscribe(SYSTEM_EVENTS_CHANNEL, handleIncomingMessage);
  console.log(`👂 [EventSubscriber] Subscribed to Redis channel '${SYSTEM_EVENTS_CHANNEL}'`);
}

/**
 * Register a server-side listener for a specific entity
 */
function onEntityEvent(entity, callback) {
  const key = (entity || '*').toLowerCase();
  if (!entityListeners.has(key)) {
    entityListeners.set(key, new Set());
  }
  entityListeners.get(key).add(callback);

  return () => {
    const set = entityListeners.get(key);
    if (set) {
      set.delete(callback);
      if (set.size === 0) entityListeners.delete(key);
    }
  };
}

function setWebSocketBroadcaster(broadcaster) {
  wsBroadcaster = broadcaster;
}

function getSubscriberMetrics() {
  return {
    ...subscriberMetrics,
    registeredEntityListeners: Array.from(entityListeners.keys())
  };
}

module.exports = {
  initEventSubscriber,
  onEntityEvent,
  setWebSocketBroadcaster,
  getSubscriberMetrics
};
