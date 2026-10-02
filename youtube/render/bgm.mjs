/* 채널 BGM 베드를 합성한다. 효과음과 같은 이유로 코드로 만든다 —
   라이선스가 필요 없고, 같은 명령이 같은 파일을 만들고, 톤은 숫자로 조정된다.

   멜로디가 없다. 이 채널의 BGM은 "곡"이 아니라 "바닥"이다.
   자막이 본문이고 나레이션이 보조인데 음악까지 주장하면 화면이 안 읽힌다.

   16초 루프로 만든다. build.mjs가 영상 길이만큼 이어 붙인다.
   사용: node bgm.mjs */
import ffmpeg from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, 'bgm');
mkdirSync(out, { recursive: true });

const LOOP = 16;             // 초
const TARGET_PEAK_DB = -24;  // 나레이션보다 확실히 아래. 있는 줄 모르게 깔린다
const FMT = 'aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono';

/* 루프가 매끄러우려면 세 가지가 동시에 맞아야 한다.

   1. 각 성분이 16초에 정수 번 진동한다 (주파수가 0.0625 Hz의 배수)
   2. 필터의 초기 과도응답을 잘라낸다 — lowpass/highpass는 t=0에서 정상 상태가 아니다.
      SETTLE초를 더 굽고 앞을 버린다. 그러려면 잘라내는 지점에서도 각 성분의 위상이
      0이어야 하므로, 주파수는 1/SETTLE의 배수이기도 해야 한다 (여기선 0.5 Hz의 배수)
   3. 루프되지 않는 성분을 넣지 않는다 — 핑크 노이즈를 뺐다.
      이 채널에는 어차피 드론만 있는 게 맞다

   아래 주파수는 세 조건을 전부 만족한다. */
const SETTLE = 2;        // 초 — 필터가 자리 잡는 시간
const A1     = 55.0;     // 16초 880주기 / 2초 110주기
const A1_DET = 55.5;     // 16초 888주기 / 2초 111주기 — 0.5Hz 맥놀이
const E2     = 82.5;     // 16초 1320주기 — 5도
const A2     = 110.0;    // 16초 1760주기 — 옥타브
// tremolo는 하한이 0.1 Hz다. 트림 이후에 걸어야 루프 시작에 위상이 맞는다.
const LFO    = 0.125;    // 16초에 2주기

const GEN = LOOP + SETTLE;
const inputs = [
  `sine=frequency=${A1}:duration=${GEN}`,
  `sine=frequency=${A1_DET}:duration=${GEN}`,
  `sine=frequency=${E2}:duration=${GEN}`,
  `sine=frequency=${A2}:duration=${GEN}`,
];

const filter =
  `[0:a]volume=1.00[a];` +
  `[1:a]volume=0.85[b];` +
  `[2:a]volume=0.22[c];` +
  `[3:a]volume=0.10[d];` +
  `[a][b][c][d]amix=inputs=4:normalize=0,` +
  // 저역만 남긴다. 중고역이 있으면 나레이션과 자리를 다툰다
  `lowpass=f=900,highpass=f=32,` +
  // 필터가 자리 잡은 뒤부터 정확히 LOOP초를 취한다
  `atrim=start=${SETTLE}:end=${GEN},asetpts=PTS-STARTPTS,` +
  // 아주 느린 숨. 정지한 소리는 귀가 금방 무시한다. 트림 이후에 걸어야 위상이 맞는다
  `tremolo=f=${LFO}:d=0.22,${FMT}`;

const raw = resolve(out, '.bed.raw.wav');
const final = resolve(out, 'bed.wav');

const args = ['-y'];
inputs.forEach(i => args.push('-f', 'lavfi', '-i', i));
args.push('-filter_complex', filter, raw);
execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });

const peakOf = f => {
  const err = spawnSync(ffmpeg, ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr ?? '';
  const m = err.match(/max_volume: (-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : null;
};

const before = peakOf(raw);
const gain = (TARGET_PEAK_DB - before).toFixed(2);
execFileSync(ffmpeg, ['-y', '-i', raw, '-af', `volume=${gain}dB,${FMT}`, final],
  { stdio: ['ignore', 'ignore', 'pipe'] });
rmSync(raw, { force: true });

console.log(`bed.wav  ${LOOP}초 루프  ${before} dB → ${peakOf(final)} dB (${gain} dB)`);
console.log(`→ ${final}`);
