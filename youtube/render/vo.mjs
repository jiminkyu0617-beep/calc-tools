/* 나레이션 대본과 타임코드 명세를 씬에서 뽑는다.
   TTS로 만든 클립을 build.mjs가 정확한 시각에 얹으려면 이 명세가 필요하다.
   사용: node vo.mjs <씬디렉터리명> */
import { chromium } from 'playwright-core';
import { chromePath } from './lib/chrome.js';
import { serve } from './lib/serve.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) { console.error('씬 이름이 필요합니다: node vo.mjs <씬디렉터리명>'); process.exit(1); }

const { port, close } = await serve(root);
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/scenes/${name}/scene.html`, { waitUntil: 'networkidle' });
const { captions = [], narration = [] } = await page.evaluate(() => ({
  captions: window.__scene?.captions ?? [], narration: window.__scene?.narration ?? [],
}));
await browser.close(); close();

if (!narration.length) { console.error('나레이션이 없습니다. defineScene에 narration을 넘기세요.'); process.exit(1); }
if (narration.length !== captions.length) {
  console.error(`나레이션(${narration.length})과 자막(${captions.length}) 개수가 다릅니다. 1:1이어야 합니다.`);
  process.exit(1);
}

// 한국어를 차분히 읽는 속도를 대략 5음절/초로 잡고 여유를 점검한다.
const SYL_PER_SEC = 5.0;
const syllables = s => (s.match(/[가-힣]/g) || []).length;

const lines = narration.map((text, i) => {
  const [start, end] = captions[i];
  const window = +(end - start).toFixed(2);
  const need = +(syllables(text) / SYL_PER_SEC).toFixed(2);
  return { index: i + 1, file: `${String(i + 1).padStart(2, '0')}.wav`, start, end, window, estimate: need, text };
});

const outDir = resolve(root, 'scenes', name);
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'narration.json'), JSON.stringify({ scene: name, lines }, null, 2), 'utf8');
writeFileSync(resolve(outDir, 'narration.txt'),
  lines.map(l => `${l.file}\t${l.text}`).join('\n') + '\n', 'utf8');

const tight = lines.filter(l => l.estimate > l.window - 0.3);
console.log(`나레이션 ${lines.length}줄 → scenes/${name}/narration.json, narration.txt`);
console.table(lines.map(({ file, start, window, estimate, text }) => ({ file, start, window, estimate, text })));
if (tight.length) {
  console.warn(`\n주의: 구간이 빠듯한 줄 ${tight.length}개 — 문장을 줄이거나 씬 길이를 늘려라.`);
  tight.forEach(l => console.warn(`  ${l.file} 구간 ${l.window}초 / 예상 ${l.estimate}초 — "${l.text}"`));
} else {
  console.log('\n모든 줄이 자기 구간 안에 들어간다.');
}
