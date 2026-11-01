# ZokoAnime Scraper & Direct M3U8 API

High-performance, lightweight scraper and REST API for **ZokoAnime** ([zokoanime.video](https://zokoanime.video/player)).

Extracts direct master HLS `.m3u8` playlists, parsed quality variants (`1080p`, `720p`, etc.), WebVTT subtitles, and intro/outro timestamps directly from ZokoAnime player endpoints in milliseconds without requiring headless browsers (Puppeteer/Playwright) or FlareSolverr.

---

## ⚡ Features

- **Direct M3U8 Extraction**: Decodes obfuscated player payloads directly using the native XOR cipher (`otaku-embed-v1`).
- **Master Playlist Parsing**: Parses `#EXT-X-STREAM-INF` to return resolution streams (`1080p`, `720p`, etc.) and bandwidth.
- **Both Servers Supported**: Extracts from both `zoko` (managed player) and `kiwi` (Kiwi-Stream iframe).
- **Subtitles & Skip Markers**: Returns all available WebVTT subtitle tracks and exact intro/outro skip timestamps.
- **Flexible URL & ID Input**: Accepts MAL IDs, AniList IDs, or full player URLs (e.g. `https://zokoanime.video/player?id=21&ep=1` or `https://zokoanime.video/stream/mal/21/1/sub`).
- **Built-in CORS Stream Proxy**: Includes an HLS proxy (`/api/proxy/stream`) that rewrites playlists and forwards stream chunks to bypass browser CORS and referer checks.
- **Interactive OpenAPI/Swagger**: Interactive documentation at `/docs`.
- **In-Memory Cache**: Built-in TTL caching with request coalescing to eliminate duplicate upstream requests.
- **Zero Heavy Dependencies**: Pure Node.js with native `fetch`.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd zokoanime-scraper
npm install

# Start server:
npm start

# Or manage with PM2:
pm2 start
# or npm run pm2:start
```

### 2. CLI Usage

You can use the CLI directly:

```bash
# Extract stream from a Zoko player URL:
node src/cli.js extract "https://zokoanime.video/player?id=21&ep=1"

# Extract stream from a direct embed URL:
node src/cli.js extract "https://zokoanime.video/stream/mal/21/1/sub"

# Stream by MAL ID and Episode:
node src/cli.js stream 21 1

# Stream with AniList ID and Dubbed audio:
node src/cli.js stream 5114 1 --source=ani --track=dub

# Output as raw JSON:
node src/cli.js stream 21 1 --json

# Start the REST API server:
node src/cli.js serve --port=3008
```

---

## 📡 REST API Reference

Start the server:
```bash
npm start
# Server starts at http://localhost:3008
# Swagger UI available at http://localhost:3008/docs
```

### Endpoints

#### 1. `GET /api/stream`
Query parameters:
- `id` (string): Anime ID (MAL or AniList)
- `episode` (number, default: `1`): Episode number
- `source` (`mal` | `ani`, default: `mal`): Metadata provider
- `track` (`sub` | `dub` | `hsub`, default: `sub`): Audio/subtitle track
- `server` (`zoko` | `kiwi`, default: `zoko`): Stream backend
- `url` (string, optional): Full player or stream URL (replaces `id`/`episode`)
- `parseM3u8` (`true` | `false`, default: `true`): Parse master playlist into quality variants
- `refresh` (`true` | `false`, default: `false`): Bypass cache

**Example Request:**
```http
GET /api/stream?id=21&episode=1&source=mal&track=sub
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "server": "zoko",
    "source": "mal",
    "animeId": "21",
    "episode": 1,
    "track": "sub",
    "embedUrl": "https://zokoanime.video/stream/mal/21/1/sub",
    "masterUrl": "https://hls.dramahot.top/p/.../master.m3u8",
    "qualities": [
      {
        "quality": "1080p",
        "resolution": "1920x1080",
        "bandwidth": 5300000,
        "url": "https://hls.dramahot.top/p/.../1080/index.m3u8"
      }
    ],
    "subtitles": [
      {
        "lang": "en",
        "label": "English",
        "default": true,
        "url": "https://hls.dramahot.top/v/.../subs/6e4a0p3k8ehe9eee.vtt"
      }
    ],
    "skip": {
      "intro": { "start": 31, "end": 111 },
      "outro": { "start": 1376, "end": 1447 }
    },
    "videoId": 2806,
    "downloadUrl": "https://zokoanime.video/download/mal/21/1/sub"
  }
}
```

#### 2. `GET /api/stream/:source/:id/:episode/:track`
Path-based route identical to ZokoAnime's URL scheme:
```http
GET /api/stream/mal/21/1/sub
```

#### 3. `POST /api/extract`
Extracts directly from any URL string in JSON body:
```json
{
  "url": "https://zokoanime.video/player?id=21&ep=1",
  "parseM3u8": true
}
```

#### 4. `GET /api/proxy/stream`
Proxies M3U8 playlists and video chunks with CORS headers (`Access-Control-Allow-Origin: *`):
```http
GET /api/proxy/stream?url=https%3A%2F%2Fhls.dramahot.top%2Fp%2F...%2Fmaster.m3u8
```

#### 5. `GET /health`
Returns service uptime and cache status.

---

## 💻 Programmatic Usage (Node.js SDK)

You can import and use the scraper directly in your JavaScript / TypeScript projects:

```javascript
import { ZokoAnimeClient } from './src/client.js';

const client = new ZokoAnimeClient();

// By ID and episode:
const stream = await client.getStream({
  id: 21,
  episode: 1,
  source: 'mal',
  track: 'sub'
});

console.log('Master M3U8:', stream.masterUrl);
console.log('Available Qualities:', stream.qualities);
console.log('Subtitles:', stream.subtitles);
console.log('Intro skip:', stream.skip.intro);

// Or by URL directly:
const direct = await client.getStream('https://zokoanime.video/player?id=21&ep=1');
console.log('Stream URL:', direct.masterUrl);
```

---

## 🐳 Docker Deployment

```bash
docker compose up -d
```

The container runs on port `3008`.

---

## 🌐 Netlify Deployment

This repository includes built-in Netlify Serverless support:

1. Push this repository to GitHub/GitLab.
2. Link the repository in [Netlify](https://app.netlify.com).
3. The build configuration is automatically loaded from [`netlify.toml`](file:///c:/Users/USER/OneDrive/Desktop/JV-Hobbies/scraping/zokoanime-scraper/netlify.toml):
   - **Functions directory**: `netlify/functions`
   - **Publish directory**: `public`
   - **Build command**: `npm run build`
4. Set any optional environment variables in **Site configuration > Environment variables**:
   - `CACHE_TTL_MS` (e.g. `300000`)
   - `UPSTREAM_PROXY` / `HTTP_PROXY` (if using residential/datacenter proxies)
5. To test locally with the Netlify CLI:
   ```bash
   npx netlify dev
   ```

> **Note on Video Streaming Proxy**: For high-volume proxy streaming via `/api/proxy/stream`, container hosts like Docker/VPS, Railway, or Render are recommended due to serverless execution and response size limits. All metadata extraction endpoints work natively on Netlify.

---

## 🧪 Running Tests

```bash
npm test
npm run check
```
