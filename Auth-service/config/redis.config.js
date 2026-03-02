/**
 * Redis Configuration
 * Fast in-memory caching for improved performance
 */

const redis = require('redis');

// Redis client instance
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
async function initRedis() {
  try {
    // Create Redis client
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 50, 3000);
        }
      }
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('🔄 Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      console.log('✅ Redis: Connected and ready');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
      isConnected = false;
    });

    redisClient.on('end', () => {
      isConnected = false;
      console.log('🔌 Redis: Connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    console.log('⚠️  Falling back to in-memory cache');
    isConnected = false;
    return null;
  }
}

/**
 * Get cached data from Redis
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached data or null
 */
async function getCache(key) {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error.message);
    return null;
  }
}

/**
 * Set data in Redis cache
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 */
async function setCache(key, value, ttl = 300) {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Delete cached data
 * @param {string} key - Cache key
 */
async function deleteCache(key) {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Redis DEL error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'dashboard:*')
 */
async function deleteCachePattern(pattern) {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️  Deleted ${keys.length} cache keys matching: ${pattern}`);
    }
    return true;
  } catch (error) {
    console.error(`Redis pattern delete error for ${pattern}:`, error.message);
    return false;
  }
}

/**
 * Clear all cache
 */
async function clearAllCache() {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    await redisClient.flushDb();
    console.log('🗑️  Redis: All cache cleared');
    return true;
  } catch (error) {
    console.error('Redis FLUSHDB error:', error.message);
    return false;
  }
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected;
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis: Connection closed gracefully');
    } catch (error) {
      console.error('Redis close error:', error.message);
    }
  }
}

module.exports = {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  clearAllCache,
  isRedisConnected,
  closeRedis
};
