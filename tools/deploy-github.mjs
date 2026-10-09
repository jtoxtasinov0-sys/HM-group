// Saytni GitHub Pages'ga joylash (zaxira manzil): npm run deploy:github
// Saytni /<repo-nomi>/ yo'li bilan yig'adi va dist/ ni "gh-pages" branch'iga push qiladi.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const sh = (cmd, cwd = ROOT, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const out = (cmd) => { try { return execSync(cmd, { cwd: ROOT }).toString().trim(); } catch { return ''; } };

const remote = out('git remote get-url origin');
if (!remote) throw new Error('git remote "origin" topilmadi');
const repo = remote.replace(/\.git$/, '').split('/').pop();
const name = out('git config user.name') || 'deploy';
const email = out('git config user.email') || 'deploy@localhost';

const owner0 = remote.replace(/.git$/, '').split('/').slice(-2, -1)[0].toLowerCase();
sh('npx vite build', ROOT, { BASE_PATH: `/${repo}/`, SITE_URL: `https://${owner0}.github.io/${repo}` });
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

const gitDir = path.join(DIST, '.git');
fs.rmSync(gitDir, { recursive: true, force: true });
sh('git init -q -b gh-pages', DIST);
sh('git add -A', DIST);
sh(`git -c user.name="${name}" -c user.email="${email}" commit -q -m "deploy"`, DIST);
sh(`git push -f "${remote}" gh-pages`, DIST);
fs.rmSync(gitDir, { recursive: true, force: true });

const owner = remote.replace(/\.git$/, '').split('/').slice(-2, -1)[0];
console.log(`\nTayyor: https://${owner.toLowerCase()}.github.io/${repo}/`);
