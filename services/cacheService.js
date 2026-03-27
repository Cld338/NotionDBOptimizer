const redis = require('redis');

let redisClient = null;
let isConnected = false;
let connectionAttempted = false;

/**
 * Initialize Redis client
 * @returns {Promise<void>}
 */
async function initializeRedis() {
  if (connectionAttempted || isConnected) return;
  
  connectionAttempted = true;

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = redis.createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.warn('[Cache Service] Max reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return retries * 100; // Exponential backoff
        },
        connectTimeout: 10000,
        noDelay: true
      }
    });

    redisClient.on('error', (err) => {
      console.warn('[Cache Service] Redis error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[Cache Service] Redis connected');
    });

    redisClient.on('ready', () => {
      console.log('[Cache Service] Redis ready');
      isConnected = true;
    });

    redisClient.on('end', () => {
      console.log('[Cache Service] Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('[Cache Service] Redis reconnecting...');
    });

    await redisClient.connect();
    isConnected = true;
  } catch (error) {
    console.warn('[Cache Service] Failed to initialize Redis:', error.message);
    console.warn('[Cache Service] Caching disabled - application will work without cache');
    isConnected = false;
    redisClient = null;
  }
}

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached data or null if not found
 */
async function getCachedData(key) {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      console.log(`[Cache] HIT: ${key}`);
      return JSON.parse(cachedData);
    }
    console.log(`[Cache] MISS: ${key}`);
    return null;
  } catch (error) {
    console.warn(`[Cache Service] Error getting cache for ${key}:`, error.message);
    return null;
  }
}

/**
 * Store data in cache with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds (default: 600 = 10 minutes)
 * @returns {Promise<void>}
 */
async function setCachedData(key, data, ttlSeconds = 600) {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    console.log(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.warn(`[Cache Service] Error setting cache for ${key}:`, error.message);
  }
}

/**
 * Delete data from cache
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
async function deleteCachedData(key) {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.del(key);
    console.log(`[Cache] DELETE: ${key}`);
  } catch (error) {
    console.warn(`[Cache Service] Error deleting cache for ${key}:`, error.message);
  }
}

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Pattern to match (e.g., 'network:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function deleteCachedDataByPattern(pattern) {
  if (!isConnected || !redisClient) {
    return 0;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[Cache] DELETE BY PATTERN: ${pattern} (${keys.length} keys deleted)`);
      return keys.length;
    }
    return 0;
  } catch (error) {
    console.warn(`[Cache Service] Error deleting cache by pattern ${pattern}:`, error.message);
    return 0;
  }
}

/**
 * Get cache status
 * @returns {object} Redis connection status
 */
function getCacheStatus() {
  return {
    connected: isConnected,
    enabled: isConnected && redisClient !== null,
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  };
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Cache Service] Redis connection closed');
      isConnected = false;
    } catch (error) {
      console.warn('[Cache Service] Error closing Redis:', error.message);
    }
  }
}

module.exports = {
  initializeRedis,
  getCachedData,
  setCachedData,
  deleteCachedData,
  deleteCachedDataByPattern,
  getCacheStatus,
  closeRedis
};
