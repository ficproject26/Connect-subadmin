/**
 * Centralized Cache Manager
 * Provides entity-aware caching with instant invalidation upon any state mutation.
 * Guarantees real-time consistency over stale data.
 */

const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('./redisClient');

const CACHE_PREFIX = 'subadmin:cache:';

class CacheManager {
  /**
   * Build a standardized cache key
   */
  makeKey(namespace, identifier = 'all') {
    return `${CACHE_PREFIX}${namespace.toLowerCase()}:${String(identifier)}`;
  }

  /**
   * Fetch from cache or compute and store
   */
  async getOrSet(key, fetcherFn, ttlSeconds = 300) {
    try {
      const cached = await cacheGet(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (err) {
      // Proceed to fetch fresh on cache error
    }

    const freshData = await fetcherFn();
    if (freshData !== undefined) {
      try {
        await cacheSet(key, freshData, ttlSeconds);
      } catch (err) {
        // Non-blocking cache set error
      }
    }
    return freshData;
  }

  /**
   * Retrieve cached value
   */
  async get(key) {
    return cacheGet(key);
  }

  /**
   * Save value to cache with TTL
   */
  async set(key, value, ttlSeconds = 300) {
    return cacheSet(key, value, ttlSeconds);
  }

  /**
   * Invalidate specific key
   */
  async del(key) {
    return cacheDel(key);
  }

  /**
   * Instantly invalidate all caches for a given entity
   * Called immediately whenever a database write/update/delete succeeds.
   */
  async invalidateEntity(entityName, entityId = null) {
    if (!entityName) return;
    const cleanEntity = entityName.toLowerCase();
    
    // Invalidate the entity's global list/aggregates
    await cacheDelPattern(`${CACHE_PREFIX}${cleanEntity}:*`);

    // Invalidate hierarchy/summary if geo or admin entities changed
    if (['states', 'districts', 'divisions', 'pincodes', 'users', 'managers'].includes(cleanEntity)) {
      await cacheDelPattern(`${CACHE_PREFIX}hierarchy:*`);
      await cacheDelPattern(`${CACHE_PREFIX}territory:*`);
      await cacheDelPattern(`${CACHE_PREFIX}reports:*`);
    }

    if (['orders', 'bookings', 'jobs', 'payments', 'vendors', 'customers'].includes(cleanEntity)) {
      await cacheDelPattern(`${CACHE_PREFIX}dashboard:*`);
      await cacheDelPattern(`${CACHE_PREFIX}reports:*`);
    }
  }

  /**
   * Clear all application caches
   */
  async clearAll() {
    await cacheDelPattern(`${CACHE_PREFIX}*`);
  }
}

const cacheManager = new CacheManager();
module.exports = cacheManager;
