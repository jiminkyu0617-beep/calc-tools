/* 채널 효과음을 합성한다. 외부 소스를 쓰지 않는다 — 라이선스가 필요 없고,
   같은 명령이 같은 파일을 만들며, 톤을 바꾸려면 이 파일의 숫자를 고치면 된다.

   세 개뿐이다. 룩북 규칙: "SFX 남발 금지, 의미 있는 순간에만."
     lock  — 숫자가 확정되는 순간
     open  — 형태가 열리는 순간
     shift — 축의 의미가 바뀌는 순간

   사용: node sfx.mjs */
import ffmpeg from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, 'sfx');
mkdirSync(out, { recursive: true });

const FMT = 'aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono';
// 건조한 채널이다. 세 소리의 피크를 같은 값으로 맞춘다.
// 성분 volume을 손으로 맞추면 반드시 어긋난다(감쇠 곡선이 저역에서 피크를 더 깎는다).
// 그래서 한 번 렌더해 피크를 재고, 목표까지의 게인을 계산해 다시 굽는다.
const TARGET_PEAK_DB = -18;
const TAIL = FMT;

const peakOf = file => {
  const err = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr ?? '';
  const m = err.match(/max_volume: (-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : null;
};

const SOUNDS = [
  {
    name: 'lock',
    why: '숫자 확정 — 낮은 몸통 + 아주 짧은 딸깍',
    inputs: ['sine=frequency=68:duration=0.18', 'sine=frequency=880:duration=0.03'],
    // 저역은 한 주기가 15ms라 t=0부터 감쇠시키면 소리가 서기 전에 사라진다. 10ms 뒤부터 뺀다.
    filter: `[0:a]afade=t=out:st=0.010:d=0.17:curve=exp[a];` +
            `[1:a]afade=t=out:st=0:d=0.03:curve=exp,volume=0.25[b];` +
            `[a][b]amix=inputs=2:normalize=0,${TAIL}`,
  },
  {
    name: 'open',
    why: '형태가 열림 — 낮은 데서 살짝 올라오는 짧은 스웰',
    inputs: [`aevalsrc='sin(2*PI*t*(150+180*t))':d=0.34:s=48000`],
    filter: `[0:a]afade=t=in:st=0:d=0.10,afade=t=out:st=0.12:d=0.22:curve=exp,${TAIL}`,
  },
  {
    name: 'shift',
    why: '축 전환 — 마른 틱 하나',
    inputs: ['anoisesrc=d=0.045:c=pink:a=0.6', 'sine=frequency=1500:duration=0.02'],
    filter: `[0:a]highpass=f=2200,afade=t=out:st=0:d=0.045:curve=exp[a];` +
            `[1:a]afade=t=out:st=0:d=0.02:curve=exp,volume=0.35[b];` +
            `[a][b]amix=inputs=2:normalize=0,${TAIL}`,
  },
];

for (const s of SOUNDS) {
  const args = ['-y'];
  s.inputs.forEach(i => args.push('-f', 'lavfi', '-i', i));
  args.push('-filter_complex', s.filter);
  const raw = resolve(out, `.${s.name}.raw.wav`);
  const final = resolve(out, `${s.name}.wav`);

  execFileSync(ffmpeg, [...args, raw], { stdio: ['ignore', 'ignore', 'pipe'] });
  const before = peakOf(raw);
  if (before === null) { console.error(`${s.name}: 피크 측정 실패`); process.exit(1); }

  const gain = (TARGET_PEAK_DB - before).toFixed(2);
  execFileSync(ffmpeg, ['-y', '-i', raw, '-af', `volume=${gain}dB,${FMT}`, final],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  rmSync(raw, { force: true });

  const after = peakOf(final);
  const ok = Math.abs(after - TARGET_PEAK_DB) < 0.5;
  console.log(`${s.name.padEnd(6)} ${String(before).padStart(6)} dB → ${String(after).padStart(6)} dB ` +
              `(${gain > 0 ? '+' : ''}${gain} dB) ${ok ? '✅' : '❌'}  ${s.why}`);
}
console.log(`\n→ ${out}`);
