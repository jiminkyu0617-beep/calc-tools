#!/usr/bin/env python3
"""임시 나레이션 생성 (espeak-ng, ctypes 직접 구동).

주의: 이건 **자리표시용**이다. espeak-ng는 포먼트 합성이라 명백히 기계 목소리가 난다.
발행용이 아니다. 이걸 쓰는 이유는 하나 —
목소리를 사기 전에 **타이밍·믹스·덕킹이 실제로 맞는지 끝까지 확인**하기 위해서다.

진짜 목소리는 같은 파일 이름(01.wav … NN.wav)으로 갈아 끼우면 그만이다.
보이스 스펙은 youtube/voice.md.

사용: python3 tts.py <씬디렉터리명>
"""
import ctypes, json, os, subprocess, sys, wave
from pathlib import Path

import espeakng_loader

ROOT = Path(__file__).resolve().parent
scene = sys.argv[1] if len(sys.argv) > 1 else sys.exit("사용: python3 tts.py <씬디렉터리명>")
spec_path = ROOT / "scenes" / scene / "narration.json"
if not spec_path.exists():
    sys.exit(f"명세가 없습니다. 먼저: node vo.mjs {scene}")

spec = json.loads(spec_path.read_text(encoding="utf-8"))
out_dir = ROOT / "out" / scene / "vo-placeholder"
out_dir.mkdir(parents=True, exist_ok=True)

lib = ctypes.CDLL(espeakng_loader.get_library_path())
rate = lib.espeak_Initialize(0x02, 0, espeakng_loader.get_data_path().encode(), 0)
if rate < 0:
    sys.exit("espeak-ng 초기화 실패")
if lib.espeak_SetVoiceByName(b"ko") != 0:
    sys.exit("한국어 보이스 설정 실패")

# voice.md 스펙: 낮은 톤 / 표준보다 느리게 / 평탄한 억양
espeakRATE, espeakPITCH, espeakRANGE = 1, 3, 4
lib.espeak_SetParameter(espeakRATE, 150, 0)   # 기본 175 → 약 0.86배
lib.espeak_SetParameter(espeakPITCH, 30, 0)   # 기본 50 → 낮게
lib.espeak_SetParameter(espeakRANGE, 20, 0)   # 기본 50 → 억양을 평탄하게

buf = bytearray()
CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
def _cb(wav, n, events):
    if wav and n > 0:
        buf.extend(ctypes.string_at(wav, n * 2))
    return 0
holder = CB(_cb)
lib.espeak_SetSynthCallback(holder)

ffmpeg = subprocess.run(["node", "-e", "process.stdout.write(require('ffmpeg-static'))"],
                        cwd=ROOT, capture_output=True, text=True).stdout.strip()

print(f"{'파일':<9}{'구간':>7}{'실측':>8}{'여유':>8}   대본")
over = []
for line in spec["lines"]:
    buf.clear()
    text = line["text"].encode("utf-8")
    lib.espeak_Synth(text, len(text) + 1, 0, 0, 0, 1, None, None)
    lib.espeak_Synchronize()

    raw = out_dir / f".{line['file']}.raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(bytes(buf))

    final = out_dir / line["file"]
    # 파이프라인 규격(48kHz 모노)으로 맞춘다. 볼륨 정규화는 build.mjs가 한다.
    subprocess.run([ffmpeg, "-y", "-i", str(raw), "-ar", "48000", "-ac", "1", str(final)],
                   capture_output=True, check=True)
    raw.unlink(missing_ok=True)

    dur = len(buf) / 2 / rate
    slack = line["window"] - dur
    if slack < 0:
        over.append((line["file"], dur, line["window"]))
    print(f"{line['file']:<9}{line['window']:>6.1f}s{dur:>7.2f}s{slack:>+7.2f}s   {line['text']}")

print(f"\n→ {out_dir}")
if over:
    print(f"\n❌ 구간을 넘긴 줄 {len(over)}개 — 문장을 줄이거나 씬을 늘려야 한다:")
    for f, d, w in over:
        print(f"   {f}  {d:.2f}s > {w:.1f}s")
    sys.exit(1)
print("\n✅ 모든 줄이 자기 구간 안에 들어간다.")
