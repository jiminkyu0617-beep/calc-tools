/* 프레임 시퀀스를 MP4로 조립한다.
   사용:
     node build.mjs <씬>                   무음
     node build.mjs <씬> vo.wav            단일 나레이션 트랙
     node build.mjs <씬> --vo <디렉터리>    줄 단위 클립을 narration.json의 시각에 배치

   줄 단위 배치가 이 채널의 기본이다. 나레이션 한 통으로 뽑으면 화면 타이밍과 어긋나고,
   어긋나면 화면을 다시 맞춰야 한다. 클립을 시각에 꽂으면 그럴 일이 없다. */
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [name, a1, a2] = process.argv.slice(2);
if (!name) { console.error('사용: node build.mjs <씬> [vo.wav | --vo <디렉터리>]'); process.exit(1); }

const frames = resolve(root, 'out', name, 'frames');
if (!existsSync(frames)) { console.error(`프레임이 없습니다. 먼저 capture를 돌리세요: ${frames}`); process.exit(1); }

const outFile = resolve(root, 'out', name, `${name}.mp4`);
mkdirSync(dirname(outFile), { recursive: true });

// 발행 규격: 1080×1920 / 30fps / H.264 CRF 18 / yuv420p / AAC 192k / -14 LUFS
const LOUDNORM = 'loudnorm=I=-14:TP=-1.5:LRA=11';
const args = ['-y', '-framerate', '30', '-i', `${frames}/%05d.png`];
let mode = '무음';

if (a1 === '--vo') {
  const voDir = resolve(a2 ?? '');
  const spec = resolve(root, 'scenes', name, 'narration.json');
  if (!existsSync(spec)) { console.error(`나레이션 명세가 없습니다. 먼저: node vo.mjs ${name}`); process.exit(1); }
  const { lines } = JSON.parse(readFileSync(spec, 'utf8'));

  const present = lines.filter(l => existsSync(resolve(voDir, l.file)));
  const missing = lines.filter(l => !existsSync(resolve(voDir, l.file)));
  if (!present.length) { console.error(`${voDir} 에 클립이 하나도 없습니다.`); process.exit(1); }
  if (missing.length) console.warn(`경고: 클립 없음 ${missing.map(l => l.file).join(', ')} — 그 구간은 무음이 됩니다.`);

  present.forEach(l => args.push('-i', resolve(voDir, l.file)));
  // 각 클립을 자기 시작 시각으로 지연시킨 뒤 합친다. normalize=0이라야 레벨이 죽지 않는다.
  const delays = present.map((l, i) => {
    const ms = Math.round(l.start * 1000);
    return `[${i + 1}:a]adelay=${ms}|${ms}[d${i}]`;
  });
  const chain = `${delays.join(';')};${present.map((_, i) => `[d${i}]`).join('')}` +
                `amix=inputs=${present.length}:normalize=0:dropout_transition=0[m];[m]${LOUDNORM}[ao]`;
  args.push('-filter_complex', chain, '-map', '0:v', '-map', '[ao]',
            '-c:a', 'aac', '-b:a', '192k', '-shortest');
  mode = `나레이션 ${present.length}/${lines.length}줄 배치`;
} else if (a1) {
  args.push('-i', resolve(a1), '-af', LOUDNORM, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  mode = '단일 오디오 트랙';
}

args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', outFile);

console.log(`조립 중 (${mode})...`);
execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const size = execFileSync('du', ['-h', outFile]).toString().split('\t')[0];
console.log(`완료 → ${outFile}  [${size}]`);
if (mode === '무음') console.log(`나레이션을 붙이려면: node vo.mjs ${name} → TTS로 클립 생성 → node build.mjs ${name} --vo <디렉터리>`);
