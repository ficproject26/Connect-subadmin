/**
 * Centralized Event Publisher
 * Responsible for generating, deduplicating, caching, and publishing real-time events.
 * Connects directly to Redis Pub/Sub and invalidates affected caches.
 */

const { publish } = require('../redis/redisClient');
const cacheManager = require('../redis/cacheManager');
const {
  SYSTEM_EVENTS_CHANNEL,
  createEvent,
  EventActions
} = require('./eventStandards');

// Ring buffer of recent event IDs for deduplication
const RECENT_DEDUP_WINDOW_MS = 300;
const recentHashes = new Map(); // hash -> timestamp

// In-memory bounded event history for state synchronization on client reconnect
const MAX_HISTORY = 500;
const eventHistory = []; // sorted by timestamp/version

// Real-time telemetry metrics
const publisherMetrics = {
  totalPublished: 0,
  totalDeduplicated: 0,
  lastPublishedAt: null,
  eventsByEntity: {}
};

/**
 * Generate a lightweight hash key for deduplication
 */
function makeDedupKey(entity, action, entityId) {
  return `${entity}:${action}:${String(entityId)}`;
}

class EventPublisher {
  /**
   * Publish an entity mutation event
   */
  async publishEntityEvent(entity, action, data, entityId = null, customScope = null) {
    if (!entity) return null;

    const resolvedId = entityId || (data ? (data._id || data.id) : null);
    const dedupKey = makeDedupKey(entity, action, resolvedId);
    const now = Date.now();

    // Check for rapid duplicate events within dedup window
    const lastSeen = recentHashes.get(dedupKey);
    if (lastSeen && (now - lastSeen) < RECENT_DEDUP_WINDOW_MS && action !== EventActions.BATCH_CREATED) {
      publisherMetrics.totalDeduplicated++;
      return null;
    }
    recentHashes.set(dedupKey, now);

    // Clean up old dedup keys periodically
    if (recentHashes.size > 2000) {
      for (const [key, ts] of recentHashes.entries()) {
        if (now - ts > 5000) recentHashes.delete(key);
      }
    }

    // Build standard event
    const event = createEvent({
      entity,
      action,
      data,
      entityId: resolvedId,
      customScope
    });

    // Invalidate affected cache entries immediately
    cacheManager.invalidateEntity(entity, resolvedId).catch(err => {
      console.warn(`[Cache] Invalidation warning for ${entity}:`, err.message);
    });

    // Record in historical replay buffer
    eventHistory.push(event);
    if (eventHistory.length > MAX_HISTORY) {
      eventHistory.shift();
    }

    // Update telemetry
    publisherMetrics.totalPublished++;
    publisherMetrics.lastPublishedAt = event.timestamp;
    publisherMetrics.eventsByEntity[entity] = (publisherMetrics.eventsByEntity[entity] || 0) + 1;

    // Distribute via Redis Pub/Sub
    try {
      await publish(SYSTEM_EVENTS_CHANNEL, event);
    } catch (err) {
      console.error(`[EventPublisher] Failed to publish ${event.event}:`, err.message);
    }

    return event;
  }

  /**
   * Publish a batch of entities
   */
  async publishBatchEvent(entity, action, items = []) {
    if (!items || items.length === 0) return null;
    return this.publishEntityEvent(entity, action, { items, count: items.length });
  }

  /**
   * Replay events since a given ISO timestamp or numeric version
   * Used for lightweight state catchup upon WebSocket reconnection.
   */
  getEventsSince(sinceTimestampOrVersion) {
    if (!sinceTimestampOrVersion) return eventHistory.slice(-50);

    let threshold;
    if (typeof sinceTimestampOrVersion === 'number') {
      threshold = sinceTimestampOrVersion;
      return eventHistory.filter(e => e.version > threshold);
    }

    const parsedDate = new Date(sinceTimestampOrVersion).getTime();
    if (isNaN(parsedDate)) return eventHistory.slice(-50);

    return eventHistory.filter(e => new Date(e.timestamp).getTime() > parsedDate);
  }

  getMetrics() {
    return {
      ...publisherMetrics,
      historyLength: eventHistory.length
    };
  }
}

const eventPublisher = new EventPublisher();
module.exports = eventPublisher;
