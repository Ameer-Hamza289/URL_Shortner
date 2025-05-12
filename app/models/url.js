/**
 * URL model for storing and retrieving shortened URLs
 * Uses Redis as a storage backend
 */
const { createClient } = require('redis');

// Get Redis client instance from the app
let redisClient = null;

/**
 * Initialize the URL model with a Redis client
 * @param {Object} client - Redis client instance
 */
const initialize = (client) => {
  redisClient = client;
};

/**
 * Create a shortened URL
 * @param {string} shortId - The short ID for the URL
 * @param {string} originalUrl - The original URL to redirect to
 * @param {number} [expiresInDays=30] - Number of days until expiration
 * @returns {Promise<boolean>} - True if successful
 */
const createShortUrl = async (shortId, originalUrl, expiresInDays = 30) => {
  if (!redisClient || !redisClient.isReady) {
    throw new Error('Redis client not initialized or not ready');
  }

  // Store the URL with expiration
  const expirySeconds = expiresInDays * 24 * 60 * 60;
  
  // Store mapping from short ID to original URL
  await redisClient.set(`url:${shortId}`, originalUrl);
  await redisClient.expire(`url:${shortId}`, expirySeconds);
  
  // Store creation timestamp
  await redisClient.set(`url:${shortId}:created`, Date.now().toString());
  await redisClient.expire(`url:${shortId}:created`, expirySeconds);
  
  // Increment and store access count
  await redisClient.set(`url:${shortId}:hits`, '0');
  await redisClient.expire(`url:${shortId}:hits`, expirySeconds);

  return true;
};

/**
 * Get the original URL from a short ID
 * @param {string} shortId - The short ID to look up
 * @returns {Promise<string|null>} - The original URL or null if not found
 */
const getOriginalUrl = async (shortId) => {
  if (!redisClient || !redisClient.isReady) {
    throw new Error('Redis client not initialized or not ready');
  }

  // Get the original URL
  return await redisClient.get(`url:${shortId}`);
};

/**
 * Increment the hit count for a short URL
 * @param {string} shortId - The short ID
 * @returns {Promise<number>} - The new hit count
 */
const incrementHits = async (shortId) => {
  if (!redisClient || !redisClient.isReady) {
    throw new Error('Redis client not initialized or not ready');
  }

  // Increment the hit counter
  return await redisClient.incr(`url:${shortId}:hits`);
};

/**
 * Get statistics for a short URL
 * @param {string} shortId - The short ID
 * @returns {Promise<Object>} - Statistics object
 */
const getUrlStats = async (shortId) => {
  if (!redisClient || !redisClient.isReady) {
    throw new Error('Redis client not initialized or not ready');
  }

  // Get original URL
  const originalUrl = await redisClient.get(`url:${shortId}`);
  
  if (!originalUrl) {
    return null;
  }
  
  // Get creation time
  const created = await redisClient.get(`url:${shortId}:created`);
  
  // Get hit count
  const hits = await redisClient.get(`url:${shortId}:hits`) || '0';
  
  // Get TTL in seconds
  const ttl = await redisClient.ttl(`url:${shortId}`);
  
  return {
    shortId,
    originalUrl,
    created: parseInt(created),
    hits: parseInt(hits),
    // Convert TTL to days (rough estimate)
    expiresInDays: Math.max(0, Math.ceil(ttl / (24 * 60 * 60)))
  };
};

/**
 * Check if a short ID exists
 * @param {string} shortId - The short ID to check
 * @returns {Promise<boolean>} - True if the short ID exists
 */
const shortIdExists = async (shortId) => {
  if (!redisClient || !redisClient.isReady) {
    throw new Error('Redis client not initialized or not ready');
  }

  return await redisClient.exists(`url:${shortId}`) === 1;
};

module.exports = {
  initialize,
  createShortUrl,
  getOriginalUrl,
  incrementHits,
  getUrlStats,
  shortIdExists
}; 