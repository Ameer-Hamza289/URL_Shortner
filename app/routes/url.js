const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const validUrl = require('valid-url');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const urlModel = require('../models/url');

// Rate limiter configurations
const createUrlLimiter = (redisClient, useRedis) => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 URLs per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'You can only create 5 short URLs per minute',
    retryAfter: 60
  },
  // Use Redis as store if available, otherwise use memory store
  ...(useRedis && redisClient.isReady && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'ratelimit:create:',
      expiry: 120, // in seconds
    })
  }),
  keyGenerator: (req) => {
    // Use IP to identify unique requests for creation
    return `${req.ip}`;
  }
});

const redirectLimiter = (redisClient, useRedis) => rateLimit({
  windowMs: 3000, // 3 seconds
  max: 10, // 10 redirects per 3 seconds
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many redirects. Please try again in a few seconds.',
    retryAfter: 3
  },
  // Use Redis as store if available, otherwise use memory store
  ...(useRedis && redisClient.isReady && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'ratelimit:redirect:',
      expiry: 10, // in seconds
    })
  }),
  keyGenerator: (req) => {
    // Use IP to identify unique requests for redirects
    return `${req.ip}`;
  }
});

const statsLimiter = (redisClient, useRedis) => rateLimit({
  windowMs: 10000, // 10 seconds
  max: 5, // 5 stats requests per 10 seconds
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'You can only check stats 5 times per 10 seconds',
    retryAfter: 10
  },
  // Use Redis as store if available, otherwise use memory store
  ...(useRedis && redisClient.isReady && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'ratelimit:stats:',
      expiry: 30, // in seconds
    })
  }),
  keyGenerator: (req) => {
    // Use IP and shortId to identify unique requests for stats
    return `${req.ip}:${req.params.shortId}`;
  }
});

// Initialize the router with Redis client
const initialize = (app, redisClient, useRedis) => {
  // Initialize the URL model
  urlModel.initialize(redisClient);
  
  // Create short URL
  app.post('/api/url/shorten', createUrlLimiter(redisClient, useRedis), async (req, res) => {
    const { longUrl, customAlias } = req.body;
    
    // Validate URL
    if (!validUrl.isWebUri(longUrl)) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid URL including protocol (http:// or https://)'
      });
    }
    
    try {
      // Generate or use custom short ID
      let shortId;
      
      if (customAlias) {
        // Validate custom alias
        if (!/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
          return res.status(400).json({
            error: 'Invalid custom alias',
            message: 'Custom alias can only contain letters, numbers, hyphens, and underscores'
          });
        }
        
        // Check if custom alias is already in use
        const exists = await urlModel.shortIdExists(customAlias);
        if (exists) {
          return res.status(409).json({
            error: 'Alias already exists',
            message: 'This custom alias is already in use. Please choose another one.'
          });
        }
        
        shortId = customAlias;
      } else {
        // Generate a unique short ID
        shortId = nanoid(7); // 7-character ID
        
        // Make sure it's unique (unlikely to collide but just in case)
        while (await urlModel.shortIdExists(shortId)) {
          shortId = nanoid(7);
        }
      }
      
      // Create the short URL
      await urlModel.createShortUrl(shortId, longUrl);
      
      // Get the base URL from the request
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.status(201).json({
        shortId,
        shortUrl: `${baseUrl}/${shortId}`,
        longUrl,
        message: 'URL shortened successfully'
      });
    } catch (err) {
      console.error('Error creating short URL:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Could not create short URL'
      });
    }
  });
  
  // Redirect to original URL
  app.get('/:shortId', redirectLimiter(redisClient, useRedis), async (req, res) => {
    try {
      const { shortId } = req.params;
      
      // Get the original URL
      const originalUrl = await urlModel.getOriginalUrl(shortId);
      
      if (!originalUrl) {
        return res.status(404).render('error', {
          error: 'Not found',
          message: 'The requested URL does not exist'
        });
      }
      
      // Increment hit counter
      await urlModel.incrementHits(shortId);
      
      // Redirect to the original URL
      res.redirect(originalUrl);
    } catch (err) {
      console.error('Error redirecting to URL:', err);
      res.status(500).render('error', {
        error: 'Internal server error',
        message: 'Could not redirect to the original URL'
      });
    }
  });
  
  // Stats page - HTML view
  app.get('/url/:shortId/stats', async (req, res) => {
    res.render('stats');
  });
  
  // Get URL stats - API
  app.get('/api/url/:shortId/stats', statsLimiter(redisClient, useRedis), async (req, res) => {
    try {
      const { shortId } = req.params;
      
      // Get URL stats
      const stats = await urlModel.getUrlStats(shortId);
      
      if (!stats) {
        return res.status(404).json({
          error: 'Not found',
          message: 'The requested URL does not exist'
        });
      }
      
      res.json(stats);
    } catch (err) {
      console.error('Error getting URL stats:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Could not get URL stats'
      });
    }
  });
};

module.exports = {
  initialize
}; 