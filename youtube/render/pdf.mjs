/* HTML을 인쇄용 PDF로 만든다 (디지털 상품·문서용). 저장소 루트를 서빙하므로 어느 폴더의 HTML이든 된다.
   사용: node pdf.mjs <저장소 기준 HTML 경로> <출력 PDF 경로> */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('사용: node pdf.mjs <HTML 경로> <PDF 경로>'); process.exit(1); }
const { port, close } = await serve(repo);
const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://127.0.0.1:${port}/${src}`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: resolve(out), format: 'A4', printBackground: true, preferCSSPageSize: true });
const pages = await p.evaluate(() => document.querySelectorAll('.page').length);
console.log(`${src} → ${out}  (${pages}쪽)`); if (errs.length) console.warn('오류:', errs);
await b.close(); close();
