// HM Group — obzor videolarini (Instagram Reels) saytga tayyorlash.
// Ishlatish: npm run reels                     (hammasi)
//            npm run reels -- DTNWGIZko-m      (faqat tanlanganlar)
// Kerak: ffmpeg va yt-dlp (winget install Gyan.FFmpeg yt-dlp.yt-dlp)
//
// Manba: HM_Group_mashinalar/obzorlar/<id>.mp4 — yo'q bo'lsa, yt-dlp bilan Instagram'dan yuklanadi
// (yoki videoni shu nomda qo'lda qo'ying). Natija (src/data/stock.js → REELS):
//   public/reels/<id>.mp4          — to'liq video, ovozi bilan (bosilganda ochiladi)
//   public/reels/<id>-preview.mp4  — 12 soniyalik ovozsiz parcha (kartochkada o'ynab turadi)
//   public/reels/<id>.webp         — muqova (video yuklanguncha)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REELS, reelUrl } from '../src/data/stock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'HM_Group_mashinalar', 'obzorlar');
const OUT_DIR = path.join(ROOT, 'public', 'reels');

// to'liq video 540×960 (katta oynada ~90vh), parcha 480×854 (kartochka ~300px, retina x2)
const FULL_H = 960;
const PREVIEW_H = 854;
const PREVIEW_START = 0.3; // ba'zi reels qora kadr bilan boshlanadi
const PREVIEW_LEN = 12;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.error) throw new Error(`${cmd} topilmadi — o'rnating (yuqoridagi izohga qarang)`);
  if (r.status !== 0) throw new Error(`${cmd}: ${r.stderr.toString().trim().split('\n').slice(-3).join('\n')}`);
}
const ff = (...args) => run('ffmpeg', ['-v', 'error', '-y', ...args]);
const x264 = (h, crf, maxrate) => [
  '-vf', `scale=-2:${h}:flags=lanczos,fps=30`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-maxrate', maxrate, '-bufsize', `${parseInt(maxrate) * 2}k`,
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
];

const only = process.argv.slice(2);
const list = only.length ? REELS.filter((r) => only.includes(r.id)) : REELS;
fs.mkdirSync(SRC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const { id } of list) {
  const src = path.join(SRC_DIR, `${id}.mp4`);
  if (!fs.existsSync(src)) {
    console.log(`${id}: Instagram'dan yuklanmoqda...`);
    run('yt-dlp', ['-q', '--no-warnings', '-f', 'bv*[height<=1280]+ba/b', '--merge-output-format', 'mp4', '-o', src, reelUrl(id)]);
  }
  const full = path.join(OUT_DIR, `${id}.mp4`);
  const preview = path.join(OUT_DIR, `${id}-preview.mp4`);
  const poster = path.join(OUT_DIR, `${id}.webp`);
  ff('-i', src, ...x264(FULL_H, 29, '1000k'), '-c:a', 'aac', '-b:a', '96k', '-ac', '2', full);
  ff('-ss', String(PREVIEW_START), '-t', String(PREVIEW_LEN), '-i', src, ...x264(PREVIEW_H, 31, '600k'), '-an', preview);
  ff('-i', preview, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', poster);
  const sizes = [full, preview, poster].map((f) => fs.statSync(f).size);
  total += sizes.reduce((a, b) => a + b, 0);
  console.log(`${id.padEnd(14)} video ${(sizes[0] / 1048576).toFixed(1)} MB  parcha ${(sizes[1] / 1024).toFixed(0)} KB  muqova ${(sizes[2] / 1024).toFixed(0)} KB`);
}
console.log(`jami ${(total / 1048576).toFixed(1)} MB`);
