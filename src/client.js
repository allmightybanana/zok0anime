import { deobfuscate, extractPayloadFromHtml, extractKiwiM3u8 } from './deobfuscate.js';
import { parseMasterM3u8, parsePlayerUrl, buildEmbedUrl } from './parsers.js';
import { defaultCache } from './cache.js';
import { proxyFetch } from './proxy-agent.js';

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export class ZokoAnimeClient {
  /**
   * @param {Object} options
   * @param {string} [options.baseUrl='https://zokoanime.video']
   * @param {import('./cache.js').MemoryCache} [options.cache]
   * @param {number} [options.timeout=15000] Request timeout in ms
   * @param {string} [options.userAgent]
   */
  constructor({
    baseUrl = 'https://zokoanime.video',
    cache = defaultCache,
    timeout = 15000,
    userAgent = DEFAULT_USER_AGENT
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.cache = cache;
    this.timeout = timeout;
    this.userAgent = userAgent;
  }

  /**
   * Helper to perform HTTP GET requests with custom timeout and browser headers.
   * @param {string} url
   * @param {Record<string, string>} [customHeaders={}]
   * @returns {Promise<Response>}
   */
  async request(url, customHeaders = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await proxyFetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...customHeaders
        }
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetches an M3U8 playlist with appropriate headers.
   * @param {string} url
   * @returns {Promise<string>}
   */
  async fetchPlaylist(url) {
    const res = await this.request(url, {
      'Referer': `${this.baseUrl}/`,
      'Origin': this.baseUrl,
      'Accept': 'application/vnd.apple.mpegurl,application/x-mpegurl,*/*'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch M3U8 playlist (HTTP ${res.status}): ${url}`);
    }

    return await res.text();
  }

  /**
   * Extracts direct M3U8 stream and metadata for an anime episode.
   * Accepts either an options object or a full URL string.
   * 
   * @param {string | {
   *   id?: string | number,
   *   episode?: number,
   *   source?: 'mal' | 'ani',
   *   track?: 'sub' | 'dub' | 'hsub',
   *   server?: 'zoko' | 'kiwi',
   *   color?: string,
   *   autoplay?: boolean,
   *   parseM3u8?: boolean,
   *   bypassCache?: boolean
   * }} input
   * @returns {Promise<{
   *   success: boolean,
   *   server: string,
   *   source: string,
   *   animeId: string,
   *   episode: number,
   *   track: string,
   *   embedUrl: string,
   *   masterUrl: string,
   *   qualities: Array<{ quality: string, resolution: string, bandwidth: number, url: string }>,
   *   subtitles: Array<{ lang: string, label: string, default: boolean, url: string }>,
   *   skip: { intro: { start: number, end: number } | null, outro: { start: number, end: number } | null },
   *   videoId?: number,
   *   downloadUrl?: string,
   *   playerConfig?: object
   * }>}
   */
  async getStream(input) {
    let options = {};

    if (typeof input === 'string') {
      const parsed = parsePlayerUrl(input);
      if (!parsed) {
        throw new Error(`Invalid ZokoAnime URL or identifier: "${input}"`);
      }
      options = parsed;
    } else if (typeof input === 'object' && input !== null) {
      if (input.url) {
        const parsed = parsePlayerUrl(input.url);
        if (!parsed) {
          throw new Error(`Invalid ZokoAnime URL in options: "${input.url}"`);
        }
        options = { ...parsed, ...input };
      } else {
        options = { ...input };
      }
    } else {
      throw new Error('Input must be a URL string or an options object');
    }

    const server = (options.server || 'zoko').toLowerCase();
    const source = (options.source || 'mal').toLowerCase();
    const animeId = String(options.id || options.animeId || '');
    const episode = parseFloat(options.episode || 1) || 1;
    const track = (options.track || 'sub').toLowerCase();
    const parseM3u8 = options.parseM3u8 !== false;
    const bypassCache = Boolean(options.bypassCache);

    if (!animeId) {
      throw new Error('Anime id is required (e.g. MAL ID: 21 or AniList ID: 21)');
    }

    const cacheKey = `stream:${server}:${source}:${animeId}:${episode}:${track}:m3u8=${parseM3u8}`;

    if (!bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const fetcher = async () => {
      const embedUrl = buildEmbedUrl({
        server,
        source,
        id: animeId,
        episode,
        track,
        color: options.color,
        autoplay: options.autoplay
      });

      const res = await this.request(embedUrl);
      if (res.status === 404) {
        throw new Error(`Episode not found (404) on ZokoAnime for source=${source}, id=${animeId}, episode=${episode}, track=${track}`);
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status} while fetching embed: ${embedUrl}`);
      }

      const html = await res.text();

      // Check if page displays "Not found"
      if (html.includes('class="code">404</span>') || html.includes('Not <span class="stroke">found.</span>')) {
        throw new Error(`Episode not found on ZokoAnime for source=${source}, id=${animeId}, episode=${episode}, track=${track}`);
      }

      if (server === 'kiwi') {
        const directM3u8 = extractKiwiM3u8(html);
        if (!directM3u8) {
          throw new Error(`Failed to extract Kiwi-Stream direct M3U8 from embed: ${embedUrl}`);
        }

        let qualities = [];
        if (parseM3u8) {
          try {
            const m3u8Content = await this.fetchPlaylist(directM3u8);
            qualities = parseMasterM3u8(m3u8Content, directM3u8);
          } catch (err) {
            // If master fetch fails, qualities will remain empty
            console.warn(`Warning: Could not parse master M3U8 from Kiwi-Stream: ${err.message}`);
          }
        }

        return {
          success: true,
          server: 'kiwi',
          source,
          animeId,
          episode,
          track,
          embedUrl,
          masterUrl: directM3u8,
          qualities,
          subtitles: [],
          skip: { intro: null, outro: null },
          videoId: null,
          downloadUrl: null,
          playerConfig: null
        };
      }

      // Default server: Zoko
      const blob = extractPayloadFromHtml(html);
      if (!blob) {
        throw new Error(`Could not find obfuscated stream payload (window.__P) in embed page: ${embedUrl}`);
      }

      const payload = deobfuscate(blob);
      const masterUrl = payload.src;

      if (!masterUrl) {
        throw new Error(`No stream URL found in deobfuscated payload for: ${embedUrl}`);
      }

      let qualities = [];
      if (parseM3u8) {
        try {
          const m3u8Content = await this.fetchPlaylist(masterUrl);
          qualities = parseMasterM3u8(m3u8Content, masterUrl);
        } catch (err) {
          console.warn(`Warning: Could not parse master M3U8: ${err.message}`);
        }
      }

      // Normalize subtitles
      const subtitles = (payload.subtitles || []).map(s => ({
        lang: s.lang || 'en',
        label: s.label || s.lang || 'Unknown',
        default: Boolean(s.default),
        url: s.src
      }));

      // Normalize skip
      const skip = {
        intro: (payload.skip && payload.skip.intro && payload.skip.intro.start !== undefined)
          ? { start: payload.skip.intro.start, end: payload.skip.intro.end }
          : null,
        outro: (payload.skip && payload.skip.outro && payload.skip.outro.start !== undefined)
          ? { start: payload.skip.outro.start, end: payload.skip.outro.end }
          : null
      };

      return {
        success: true,
        server: 'zoko',
        source,
        animeId,
        episode,
        track,
        embedUrl,
        masterUrl,
        qualities,
        subtitles,
        skip,
        videoId: payload.video_id || null,
        downloadUrl: payload.download_url ? `${this.baseUrl}${payload.download_url}` : null,
        playerConfig: payload.player || null
      };
    };

    if (bypassCache) {
      return await fetcher();
    }

    return await this.cache.wrap(cacheKey, fetcher, 300000); // 5 min TTL
  }
}

export const defaultClient = new ZokoAnimeClient();
