import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

export const apps = [
  {
    name: 'zokoanime-scraper',
    cwd: __dirname,
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    env_file: '.env',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: process.env.PORT || 3008,
      HOST: process.env.HOST || '0.0.0.0',
      ZOKOANIME_BASE_URL: process.env.ZOKOANIME_BASE_URL || 'https://zokoanime.video',
      CACHE_TTL_MS: process.env.CACHE_TTL_MS || 300000,
      UPSTREAM_PROXY: process.env.UPSTREAM_PROXY || '',
      HTTP_PROXY: process.env.HTTP_PROXY || '',
    },
    env_development: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
  },
];

export default { apps };
