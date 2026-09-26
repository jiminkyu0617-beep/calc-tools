import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
const { port, close } = await serve(process.cwd());
const b = await chromium.launch({ executablePath: chromePath(), args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs=[]; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/scenes/001-deepest-hole/scene.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const ok = await p.evaluate(() => !!window.__scene);
console.log('씬 초기화:', ok, '오류:', errs.length ? errs.slice(0,3) : '없음');
if (ok) { const t0 = Date.now();
  for (const t of [8, 20, 33, 45]) { await p.evaluate(x => window.__scene.seek(Math.round(x*30)), t); await p.screenshot({ path: `out/001-deepest-hole/preview/gl_t${t}.png` }); }
  console.log('4프레임 평균', ((Date.now()-t0)/4/1000).toFixed(2), '초/프레임'); }
await b.close(); close();
