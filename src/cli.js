#!/usr/bin/env node
import { defaultClient } from './client.js';
import { createApp } from './app.js';
import { initProxyAgent } from './proxy-agent.js';

initProxyAgent();

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
ZokoAnime Scraper CLI - Direct M3U8 Stream Extractor

Usage:
  zokoanime-scraper <command> [arguments] [options]

Commands:
  extract <url>                  Extract direct M3U8 from player/stream URL
  stream <id> [episode]          Get stream and quality variants for anime
  serve [--port=3008]            Start the REST API server

Options:
  --source=<mal|ani>             Metadata source (default: mal)
  --track=<sub|dub|hsub>         Audio/subtitle track (default: sub)
  --server=<zoko|kiwi>           Server backend (default: zoko)
  --no-m3u8                      Skip fetching & parsing quality variants
  --json                         Output formatted JSON
  --help                         Show this help message

Examples:
  # Extract directly from a player or stream URL:
  zokoanime-scraper extract "https://zokoanime.video/player?id=21&ep=1"
  zokoanime-scraper extract "https://zokoanime.video/stream/mal/21/1/sub"

  # Stream by MAL ID and Episode:
  zokoanime-scraper stream 21 1 --track=sub
  zokoanime-scraper stream 5114 1 --source=ani --track=dub
  zokoanime-scraper stream 21 1 --json

  # Run API server:
  zokoanime-scraper serve --port=3008
`);
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  const isJson = args.includes('--json');
  const noM3u8 = args.includes('--no-m3u8');
  const sourceArg = args.find(a => a.startsWith('--source='));
  const source = sourceArg ? sourceArg.split('=')[1] : 'mal';
  const trackArg = args.find(a => a.startsWith('--track='));
  const track = trackArg ? trackArg.split('=')[1] : 'sub';
  const serverArg = args.find(a => a.startsWith('--server='));
  const server = serverArg ? serverArg.split('=')[1] : 'zoko';
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3008;

  try {
    switch (command) {
      case 'extract': {
        const url = args[1];
        if (!url) {
          console.error('Error: Please provide a ZokoAnime URL to extract.');
          process.exit(1);
        }

        const data = await defaultClient.getStream({
          url,
          parseM3u8: !noM3u8
        });

        if (isJson) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        console.log('\n================== ZOKOANIME STREAM ==================');
        console.log(`Anime ID:    ${data.animeId} (Source: ${data.source.toUpperCase()})`);
        console.log(`Episode:     ${data.episode}`);
        console.log(`Track:       ${data.track.toUpperCase()}`);
        console.log(`Server:      ${data.server}`);
        console.log(`Master M3U8: ${data.masterUrl}`);

        if (data.skip?.intro || data.skip?.outro) {
          console.log('\n--- Timestamps ---');
          if (data.skip.intro) console.log(`Intro: ${data.skip.intro.start}s - ${data.skip.intro.end}s`);
          if (data.skip.outro) console.log(`Outro: ${data.skip.outro.start}s - ${data.skip.outro.end}s`);
        }

        if (data.qualities && data.qualities.length > 0) {
          console.log('\n--- Quality Streams ---');
          for (const q of data.qualities) {
            console.log(`[${q.quality.padEnd(5)}] ${q.resolution.padEnd(10)} ${(q.bandwidth / 1000).toFixed(0)} kbps -> ${q.url}`);
          }
        }

        if (data.subtitles && data.subtitles.length > 0) {
          console.log('\n--- Subtitles ---');
          for (const s of data.subtitles) {
            console.log(`[${s.lang}] ${s.label}${s.default ? ' (default)' : ''}: ${s.url}`);
          }
        }
        console.log('======================================================\n');
        break;
      }

      case 'stream': {
        const id = args[1];
        const episode = args[2] ? parseFloat(args[2]) : 1;
        if (!id) {
          console.error('Error: Please provide an Anime ID (e.g., MAL ID 21).');
          process.exit(1);
        }

        const data = await defaultClient.getStream({
          id,
          episode,
          source,
          track,
          server,
          parseM3u8: !noM3u8
        });

        if (isJson) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        console.log('\n================== ZOKOANIME STREAM ==================');
        console.log(`Anime ID:    ${data.animeId} (Source: ${data.source.toUpperCase()})`);
        console.log(`Episode:     ${data.episode}`);
        console.log(`Track:       ${data.track.toUpperCase()}`);
        console.log(`Server:      ${data.server}`);
        console.log(`Master M3U8: ${data.masterUrl}`);

        if (data.skip?.intro || data.skip?.outro) {
          console.log('\n--- Timestamps ---');
          if (data.skip.intro) console.log(`Intro: ${data.skip.intro.start}s - ${data.skip.intro.end}s`);
          if (data.skip.outro) console.log(`Outro: ${data.skip.outro.start}s - ${data.skip.outro.end}s`);
        }

        if (data.qualities && data.qualities.length > 0) {
          console.log('\n--- Quality Streams ---');
          for (const q of data.qualities) {
            console.log(`[${q.quality.padEnd(5)}] ${q.resolution.padEnd(10)} ${(q.bandwidth / 1000).toFixed(0)} kbps -> ${q.url}`);
          }
        }

        if (data.subtitles && data.subtitles.length > 0) {
          console.log('\n--- Subtitles ---');
          for (const s of data.subtitles) {
            console.log(`[${s.lang}] ${s.label}${s.default ? ' (default)' : ''}: ${s.url}`);
          }
        }
        console.log('======================================================\n');
        break;
      }

      case 'serve': {
        const app = createApp();
        app.listen(port, () => {
          console.log(`API running at http://localhost:${port}`);
          console.log(`Swagger UI at http://localhost:${port}/docs`);
        });
        break;
      }

      default:
        console.error(`Unknown command: "${command}"`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Execution Error:', err.message);
    process.exit(1);
  }
}

main();
