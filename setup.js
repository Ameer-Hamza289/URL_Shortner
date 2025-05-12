const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up URL Shortener App...');
console.log('This app demonstrates URL shortening with rate limiting using express-rate-limit and rate-limit-redis');

// Check if .env exists, if not create it from example
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('Creating .env file from example...');
  try {
    fs.copyFileSync(
      path.join(__dirname, 'env.example'),
      path.join(__dirname, '.env')
    );
    console.log('Created .env file');
  } catch (err) {
    console.error('Error creating .env file:', err.message);
  }
}

// Install dependencies
console.log('Installing dependencies (express, redis, nanoid, valid-url, ejs, express-rate-limit, rate-limit-redis)...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully');
} catch (err) {
  console.error('Error installing dependencies:', err.message);
  process.exit(1);
}

// Check for Redis
try {
  console.log('Checking for Redis...');
  execSync('redis-cli ping', { stdio: 'pipe' });
  console.log('Redis is available! The app will use Redis for:');
  console.log('1. Storing shortened URLs and their statistics');
  console.log('2. Distributed rate limiting');
} catch (err) {
  console.log('Redis not found or not running.');
  console.log('The app will use in-memory storage for both URL data and rate limiting.');
  console.log('Note: URLs will be lost when the server restarts. For production use, please install Redis.');
  console.log('To use Redis, please install and start Redis server.');
}

console.log('\nSetup complete!');
console.log('\nTo start the application, run:');
console.log('npm start');
console.log('\nFor development with auto-reload, run:');
console.log('npm run dev');
console.log('\nOnce started, visit http://localhost:3000 in your browser to use the URL shortener'); 