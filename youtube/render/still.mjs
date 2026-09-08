/* 정지 이미지(채널 프로필·배너 등)를 렌더한다.
   씬과 같은 theme.css를 쓰므로 채널 룩이 자동으로 일치한다.
   사용: node still.mjs <brand/파일명(확장자 제외)> <가로> <세로> */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [name, w, h] = process.argv.slice(2);
if (!name || !w || !h) { console.error('사용: node still.mjs <이름> <가로> <세로>'); process.exit(1); }

// 이름에 '/'가 있으면 렌더 루트 기준 경로, 없으면 brand/ 안의 파일로 본다
const rel = name.includes('/') ? `${name}.html` : `brand/${name}.html`;
const src = resolve(root, rel);
if (!existsSync(src)) { console.error(`파일이 없습니다: ${src}`); process.exit(1); }

const outDir = resolve(root, 'out', name.includes('/') ? dirname(rel) : 'brand');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `${name.split('/').pop()}.png`);

const { port, close } = await serve(root);
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/${rel}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
console.log(`${name}: ${w}×${h} → ${out}`);
if (errs.length) console.warn('오류:', errs.slice(0, 3));
await browser.close(); close();
