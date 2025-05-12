require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

// Initialize Express app
const app = express();
app.use(express.json());

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

// Connect to Redis
let useRedis = true;
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully');
  } catch (err) {
    console.error('Redis connection error:', err);
    console.log('Falling back to in-memory rate limiter');
    useRedis = false;
  }
})();

// Configure rate limiter for API test routes
const createLimiter = () => rateLimit({
  windowMs: 3000, // 3 seconds
  max: 1, // Limit each IP to 1 request per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'Please wait 3 seconds before trying the same endpoint again',
    retryAfter: 3
  },
  // Use Redis as store if available, otherwise use memory store (default)
  ...(useRedis && redisClient.isReady && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'ratelimit:',
      expiry: 10, // in seconds
    })
  }),
  // The key generator function determines what is considered a "same request"
  keyGenerator: (req) => {
    // Use both IP and path to identify unique requests
    return `${req.ip}:${req.path}`;
  }
});

// Import routes
const apiRoutes = require('./routes/api');
const urlRoutes = require('./routes/url');

// Initialize URL shortener routes
urlRoutes.initialize(app, redisClient, useRedis);

// Apply rate limiter to specific API test routes
app.use('/api/test', createLimiter());
app.use('/api/another-test', createLimiter());
app.use('/api/submit', createLimiter());

// Use test API routes
app.use('/api', apiRoutes);

// Basic home route - redirect to URL shortener interface
app.get('/', (req, res) => {
  res.render('index');
});

// Error route for 404 (not found)
app.use((req, res, next) => {
  res.status(404).render('error', {
    error: 'Not found',
    message: 'The page you are looking for does not exist'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // API errors return JSON, page errors render error template
  if (req.path.startsWith('/api')) {
    res.status(500).json({ error: 'Something went wrong!' });
  } else {
    res.status(500).render('error', {
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using ${useRedis ? 'Redis' : 'in-memory'} store`);
  console.log(`Visit http://localhost:${PORT} in your browser to use the URL shortener`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (useRedis && redisClient.isReady) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
  process.exit(0);
}); 