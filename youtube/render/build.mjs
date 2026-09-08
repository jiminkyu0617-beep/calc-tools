/* 프레임 시퀀스를 MP4로 조립한다.
   사용: node build.mjs <씬디렉터리명> [나레이션.wav]
   나레이션을 주면 오디오를 -14 LUFS로 정규화해 붙인다. */
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const audio = process.argv[3];
if (!name) { console.error('씬 이름이 필요합니다: node build.mjs <씬디렉터리명> [audio.wav]'); process.exit(1); }

const frames = resolve(root, 'out', name, 'frames');
if (!existsSync(frames)) { console.error(`프레임이 없습니다. 먼저 capture를 돌리세요: ${frames}`); process.exit(1); }

const outFile = resolve(root, 'out', name, `${name}.mp4`);
mkdirSync(dirname(outFile), { recursive: true });

// 발행 규격: 1080×1920 / 30fps / H.264 CRF 18 / yuv420p / AAC 192k / -14 LUFS
const args = ['-y', '-framerate', '30', '-i', `${frames}/%05d.png`];
if (audio) args.push('-i', audio, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', outFile);

console.log(`조립 중${audio ? ' (오디오 포함)' : ' (무음)'}...`);
execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const size = execFileSync('du', ['-h', outFile]).toString().split('\t')[0];
console.log(`완료 → ${outFile}  [${size}]`);
if (!audio) console.log('무음 파일입니다. 나레이션을 붙이려면: node build.mjs ' + name + ' vo.wav');
