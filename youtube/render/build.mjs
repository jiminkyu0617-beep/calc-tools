/* 프레임 시퀀스를 MP4로 조립한다.
   사용:
     node build.mjs <씬>                   무음
     node build.mjs <씬> vo.wav            단일 나레이션 트랙
     node build.mjs <씬> --vo <디렉터리>    줄 단위 클립 + 효과음 배치
     node build.mjs <씬> --vo <디렉터리> --bgm   위에 BGM 베드까지 (나레이션 구간 자동 덕킹)

   줄 단위 배치가 이 채널의 기본이다. 나레이션 한 통으로 뽑으면 화면 타이밍과 어긋나고,
   어긋나면 화면을 다시 맞춰야 한다. 클립을 시각에 꽂으면 그럴 일이 없다. */
import ffmpeg from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const [name, a1, a2] = argv;
const useBgm = argv.includes('--bgm');
if (!name) { console.error('사용: node build.mjs <씬> [vo.wav | --vo <디렉터리>]'); process.exit(1); }

const frames = resolve(root, 'out', name, 'frames');
if (!existsSync(frames)) { console.error(`프레임이 없습니다. 먼저 capture를 돌리세요: ${frames}`); process.exit(1); }

const outFile = resolve(root, 'out', name, `${name}.mp4`);
mkdirSync(dirname(outFile), { recursive: true });

// 발행 규격: 1080×1920 / 30fps / H.264 CRF 18 / yuv420p / AAC 192k / -14 LUFS
const LN = 'I=-14:TP=-1.5:LRA=11';

/* loudnorm은 한 번에 돌리면 목표를 못 맞춘다(실측 -17.0 LUFS, 목표 -14).
   유튜브는 시끄러운 영상을 낮추기만 하고 조용한 영상을 올려주지는 않으므로,
   3 LU가 낮으면 다른 영상보다 작게 들린다.
   그래서 한 번 재서 측정값을 넣고 다시 굽는다 — 오디오만 돌리므로 비용은 몇 초다. */
function measureLoudness(args, graph, preLabel) {
  const probeArgs = [...args, '-filter_complex', `${graph};[${preLabel}]loudnorm=${LN}:print_format=json[ao]`,
                    '-map', '[ao]', '-f', 'null', '-'];
  const err = spawnSync(ffmpeg, probeArgs, { encoding: 'utf8', maxBuffer: 1 << 24 }).stderr ?? '';
  const m = err.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
// 오디오를 무음으로 연장해 영상 끝까지 채운다. 이게 없으면 -shortest가 영상을 잘라낸다.
// loudnorm이 샘플레이트를 바꿔 놓기도 하므로 48kHz로 되돌린다.
const PAD = 'apad,aresample=48000';
const args = ['-y', '-framerate', '30', '-i', `${frames}/%05d.png`];
let mode = '무음';

if (a1 === '--vo') {
  const voDir = resolve(a2 ?? '');
  const spec = resolve(root, 'scenes', name, 'narration.json');
  if (!existsSync(spec)) { console.error(`나레이션 명세가 없습니다. 먼저: node vo.mjs ${name}`); process.exit(1); }
  const { lines, sfx = [] } = JSON.parse(readFileSync(spec, 'utf8'));

  const present = lines.filter(l => existsSync(resolve(voDir, l.file)));
  const missing = lines.filter(l => !existsSync(resolve(voDir, l.file)));

  // 효과음은 채널 공용 자산이다 — 회차마다 다른 소리를 쓰면 채널이 안 쌓인다
  const sfxDir = resolve(root, 'sfx');
  const cues = sfx.filter(c => existsSync(resolve(sfxDir, c.file)));

  // 나레이션이 아직 없어도 효과음만으로 굽을 수 있어야 한다.
  // 그래야 목소리를 받기 전에 오디오 경로가 도는지 검증할 수 있다.
  if (!present.length && !cues.length) {
    console.error(`${voDir} 에 나레이션 클립이 없고 효과음 큐도 없습니다.`);
    process.exit(1);
  }
  if (!present.length) console.warn('나레이션 클립이 없습니다 — 효과음만 얹습니다.');
  else if (missing.length) console.warn(`경고: 클립 없음 ${missing.map(l => l.file).join(', ')} — 그 구간은 무음이 됩니다.`);
  present.forEach(l => args.push('-i', resolve(voDir, l.file)));
  cues.forEach(c => args.push('-i', resolve(sfxDir, c.file)));
  // 각 클립을 자기 시작 시각으로 지연시킨 뒤 합친다. normalize=0이라야 레벨이 죽지 않는다.
  const tracks = [
    ...present.map(l => l.start),
    ...cues.map(c => c.time),
  ];
  const delays = tracks.map((start, i) => {
    const ms = Math.round(start * 1000);
    return `[${i + 1}:a]adelay=${ms}|${ms}[d${i}]`;
  });
  /* 나레이션 버스 정리.
     그냥 합치면 트루피크가 0 dBTP를 넘고(실측 +0.05), 피크-라우드니스 차가 21.5 dB가 된다.
     -14 LUFS를 트루피크 -1.5로 맞추려면 그 차가 12.5 dB 이하여야 하므로,
     압축 없이는 목표에 닿을 수 없다(실측 -16.5에서 멈춘다).
     말소리의 큰 대목만 살짝 눌러 차를 줄이고, 메이크업으로 되올린 뒤 정규화한다.
     makeup 값은 실측으로 정했다: 0→-16.5, 4→-15.3, 7→-14.2 LUFS.
     TTS를 바꾸면 이 값도 다시 재야 한다 — build 로그의 측정값을 보고 판단한다. */
  const chain = `${delays.join(';')};${tracks.map((_, i) => `[d${i}]`).join('')}` +
                `amix=inputs=${tracks.length}:normalize=0:dropout_transition=0,` +
                `acompressor=threshold=0.06:ratio=3:attack=8:release=160:makeup=7,` +
                `alimiter=limit=0.89:level=disabled[m]`;
  let graph = chain;
  let preLabel = 'm';

  if (useBgm) {
    const bed = resolve(root, 'bgm', 'bed.wav');
    if (!existsSync(bed)) { console.error(`BGM 베드가 없습니다. 먼저: node bgm.mjs`); process.exit(1); }
    args.push('-stream_loop', '-1', '-i', bed);   // 16초 루프를 영상 길이까지 이어 붙인다
    const bedIdx = tracks.length + 1;
    // 사이드체인: 나레이션이 나오는 동안 BGM을 눌러 말이 묻히지 않게 한다.
    // 음악이 주장하면 자막이 안 읽힌다 — 이 채널에서 BGM은 바닥이지 곡이 아니다.
    graph = `${chain};[m]asplit=2[m1][sc];` +
            `[${bedIdx}:a]anull[bedraw];` +
            `[bedraw][sc]sidechaincompress=threshold=0.02:ratio=8:attack=12:release=380[bed];` +
            `[m1][bed]amix=inputs=2:normalize=0:dropout_transition=0[mix]`;
    preLabel = 'mix';
  }

  const measured = measureLoudness(args, graph, preLabel);
  const ln = measured
    ? `loudnorm=${LN}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=true`
    : `loudnorm=${LN}`;
  if (!measured) console.warn('경고: 라우드니스 측정 실패 — 1패스로 진행합니다.');
  else if (process.env.LN_DEBUG) console.log('측정:', JSON.stringify(measured));

  args.push('-filter_complex', `${graph};[${preLabel}]${ln},${PAD}[ao]`,
            '-map', '0:v', '-map', '[ao]',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest');
  mode = `나레이션 ${present.length}/${lines.length}줄 + 효과음 ${cues.length}개` +
         (useBgm ? ' + BGM' : '') + (measured ? ' · 2패스 정규화' : '');
} else if (a1) {
  args.push('-i', resolve(a1), '-af', `${LOUDNORM},${PAD}`,
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest');
  mode = '단일 오디오 트랙';
}

args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', outFile);

console.log(`조립 중 (${mode})...`);
execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const size = execFileSync('du', ['-h', outFile]).toString().split('\t')[0];
console.log(`완료 → ${outFile}  [${size}]`);
if (mode === '무음') console.log(`나레이션을 붙이려면: node vo.mjs ${name} → TTS로 클립 생성 → node build.mjs ${name} --vo <디렉터리>`);
