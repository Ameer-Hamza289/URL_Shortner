# URL Shortener with Rate Limiting

A URL shortening service with built-in rate limiting to prevent abuse using Express.js, Redis, and rate-limit-redis.

## Features

- Shorten long URLs to easy-to-share links
- Create custom aliases (e.g., `example.com/my-link`)
- Track click statistics
- Redis-based persistence with automatic expiration (30 days by default)
- Multiple rate limiters to prevent abuse:
  - Creation Rate Limit: 5 URLs per minute per IP address
  - Redirect Rate Limit: 10 redirects per 3 seconds per IP address
  - Stats Rate Limit: 5 stats requests per 10 seconds per IP address

## How It Works

The application uses:
- Express.js for the web server and API
- Redis for storing URLs and rate limiting state
- `express-rate-limit` for implementing rate limiting logic
- `rate-limit-redis` for distributed rate limiting with Redis
- Custom key generators based on IP address and endpoint

## Prerequisites

- Node.js (v14+)
- Redis server (v6+) - optional, will fall back to in-memory storage if Redis is not available

## Installation

### Quick Setup

Run the setup script which will install dependencies and create necessary configuration:

```
node setup.js
```

### Manual Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `env.example` to `.env` and modify if needed:
   ```
   cp env.example .env
   ```
4. Make sure Redis is running on localhost:6379 or set the `REDIS_URL` environment variable in your `.env` file. If Redis is not available, the app will automatically fall back to in-memory storage.

## Running the Application

Start the application:
```
npm start
```

For development with auto-reload:
```
npm run dev
```

## Using the URL Shortener

1. Open your browser and navigate to `http://localhost:3000`
2. Enter a URL to shorten (must include http:// or https://)
3. Optionally provide a custom alias
4. Click "Shorten URL" to create your short link
5. Share the shortened URL!

## API Reference

### Shorten URL
```
POST /api/url/shorten
```

Request body:
```json
{
  "longUrl": "https://example.com/very/long/url",
  "customAlias": "my-link" // optional
}
```

Response:
```json
{
  "shortId": "my-link",
  "shortUrl": "http://localhost:3000/my-link",
  "longUrl": "https://example.com/very/long/url",
  "message": "URL shortened successfully"
}
```

### Get URL Stats
```
GET /api/url/:shortId/stats
```

Response:
```json
{
  "shortId": "my-link",
  "originalUrl": "https://example.com/very/long/url",
  "created": 1651234567890,
  "hits": 42,
  "expiresInDays": 29
}
```

## Rate Limiting Behavior

The application enforces several rate limits:

1. URL Creation: 5 URLs per minute per IP address
2. URL Redirects: 10 redirects per 3 seconds per IP address
3. URL Stats: 5 stats requests per 10 seconds per IP address

When a rate limit is exceeded, the API returns a 429 status code with a message indicating when you can try again.

## Implementation Details

- The application uses Redis for both URL storage and rate limiting state
- Each shortened URL has metadata including:
  - Creation timestamp
  - Click counter
  - Expiration time (default: 30 days)
- Rate limits are implemented using different windowMs and max values for different actions
- The application automatically falls back to in-memory storage if Redis is unavailable 