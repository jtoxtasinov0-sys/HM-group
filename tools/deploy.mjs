// Saytni Vercel'ga joylash: npm run deploy  →  https://hmgroup-uz.vercel.app
// Talab: Vercel CLI (npm i -g vercel) va bir marta `vercel login`.
// Sayt yig'iladi (dist/) va tayyor statik fayllar to'g'ridan-to'g'ri yuklanadi — Vercel'da build qilinmaydi.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = 'hmgroup-uz';
const SITE_URL = `https://${PROJECT}.vercel.app`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, env = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

sh('npx vite build', { BASE_PATH: '/', SITE_URL });
sh(`vercel deploy dist --prod --yes --project ${PROJECT}`);

console.log(`\nTayyor: ${SITE_URL}`);
