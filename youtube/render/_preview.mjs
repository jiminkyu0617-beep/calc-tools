/* 키프레임만 뽑아 눈으로 검증한다. 전체 렌더 전 필수. */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const times = (process.argv[3] || '1.8,3.6,9,17.5,22,27,41.5,53.5').split(',').map(Number);
const out = resolve(root, 'out', name, 'preview'); mkdirSync(out, { recursive: true });
const { port, close } = await serve(root);
const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/scenes/${name}/scene.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const info = await p.evaluate(() => window.__scene && { d: window.__scene.duration, f: window.__scene.frames });
console.log('씬:', info || '초기화 실패');
if (info) for (const t of times) {
  await p.evaluate(x => window.__scene.seek(Math.round(x * 30)), t);
  await p.screenshot({ path: `${out}/t${String(t).replace('.', '_')}.png` });
}
console.log('오류:', errs.length ? errs.slice(0, 5) : '없음');
console.log('→', out);
await b.close(); close();
