/* 씬 HTML을 프레임 PNG 시퀀스로 뽑는다.
   사용: node capture.mjs <씬디렉터리명>   예) node capture.mjs 001-deepest-hole */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.js';

const root = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) { console.error('씬 이름이 필요합니다: node capture.mjs <씬디렉터리명>'); process.exit(1); }

const scenePath = resolve(root, 'scenes', name, 'scene.html');
if (!existsSync(scenePath)) { console.error(`씬이 없습니다: ${scenePath}`); process.exit(1); }

const outDir = resolve(root, 'out', name, 'frames');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const { port, close } = await serve(root);   // file://에서는 모듈 스크립트가 CORS로 막힌다

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/scenes/${name}/scene.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);   // 폰트 로드 전 캡처하면 첫 프레임이 깨진다

const scene = await page.evaluate(() => window.__scene && {
  frames: window.__scene.frames, fps: window.__scene.fps, duration: window.__scene.duration,
});
if (!scene) {
  console.error('씬이 초기화되지 않았습니다. defineScene()이 호출됐는지 확인하세요.');
  if (errors.length) console.error(errors.slice(0, 5).join('\n'));
  await browser.close(); close(); process.exit(1);
}
const { frames, fps, duration } = scene;

console.log(`${name}: ${duration}초 · ${fps}fps · ${frames}프레임`);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(i => window.__scene.seek(i), f);
  await page.screenshot({ path: `${outDir}/${String(f).padStart(5, '0')}.png` });
  if (f % 30 === 0 || f === frames - 1) {
    process.stdout.write(`\r  ${f + 1}/${frames} (${((f + 1) / frames * 100).toFixed(0)}%)`);
  }
}
console.log(`\n프레임 완료 → ${outDir}  [${((Date.now() - t0) / 1000).toFixed(1)}초]`);
if (errors.length) console.warn(`경고: 페이지 오류 ${errors.length}건\n  ` + errors.slice(0, 3).join('\n  '));
await browser.close();
close();
