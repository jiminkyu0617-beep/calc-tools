/* 씬의 CAPTIONS에서 업로드용 .srt를 만든다.
   자막을 대본과 씬에 두 번 적으면 반드시 어긋난다. 원본은 씬 하나다.
   사용: node srt.mjs <씬디렉터리명> */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) { console.error('씬 이름이 필요합니다: node srt.mjs <씬디렉터리명>'); process.exit(1); }

const ts = sec => {
  const ms = Math.round(sec * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};
const strip = html => html.replace(/<[^>]+>/g, '').replace(/\n/g, '\n');

const { port, close } = await serve(root);
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/scenes/${name}/scene.html`, { waitUntil: 'networkidle' });
const captions = await page.evaluate(() => window.__scene?.captions ?? []);
await browser.close(); close();

if (!captions.length) { console.error('자막이 없습니다. defineScene에 captions를 넘겼는지 확인하세요.'); process.exit(1); }

const srt = captions.map(([a, b, html], i) =>
  `${i + 1}\n${ts(a)} --> ${ts(b)}\n${strip(html)}\n`).join('\n');
const out = resolve(root, 'scenes', name, 'subtitles.srt');
writeFileSync(out, srt, 'utf8');
console.log(`자막 ${captions.length}개 → ${out}`);
