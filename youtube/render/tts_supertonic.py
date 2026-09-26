#!/usr/bin/env python3
"""001화부터 쓰는 채널 나레이션 생성기 — Supertonic 3 (Supertone, 모델 OpenRAIL-M).

보이스는 voice.md에서 고정한다. 여기 숫자를 회차마다 바꾸지 않는다.
  sid 7   : 남성. 중앙 F0 106Hz, 억양 폭 5.5반음 — 남성 5종 중 가장 평탄
  speed   : 0.90 (voice.md: 표준의 0.9~0.95배)
  seed 42 : 같은 대본이면 같은 소리. "고쳐서 다시 뽑기"의 전제다

에이전트는 소리를 들을 수 없으므로, 생성한 클립을 한국어 음성 인식기로 다시 받아 적어
대본과 대조한다. 그게 이 채널의 나레이션 검수다.

사용: python3 tts_supertonic.py <씬>           기록된 seed로 생성 (결정론적 재현)
      python3 tts_supertonic.py <씬> --search  줄마다 seed 후보를 인식기로 채점해 고르고 기록
      python3 tts_supertonic.py <씬> --check   생성 후 인식 대조 보고

seed를 줄마다 고르는 이유: 같은 목소리라도 seed에 따라 발음이 달라지고,
'이천이백육십이' 같은 반복 음절은 어떤 seed에서는 뭉개진다. 고른 seed는
scenes/<씬>/voice-seeds.json에 남겨, 다음 빌드에서 탐색 없이 같은 소리를 재현한다.
"""
import glob, json, re, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf, sherpa_onnx as so

VOICE_SID, SPEED, LANG = 7, 0.90, "ko"
SEEDS = ["42", "7", "123", "2024", "99"]   # 후보. 줄마다 인식 오류가 가장 적은 것을 고른다

ROOT = Path(__file__).resolve().parent
scene = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
check = "--check" in sys.argv
search = "--search" in sys.argv
spec = json.loads((ROOT / "scenes" / scene / "narration.json").read_text(encoding="utf-8"))
out = ROOT / "out" / scene / "vo"; out.mkdir(parents=True, exist_ok=True)

M = next(iter(glob.glob(str(ROOT / "models/sherpa-onnx-supertonic-3-*"))), None)
if not M: sys.exit("모델이 없습니다. 먼저: ./fetch-models.sh")
cfg = so.OfflineTtsSupertonicModelConfig(
    duration_predictor=f"{M}/duration_predictor.int8.onnx", text_encoder=f"{M}/text_encoder.int8.onnx",
    vector_estimator=f"{M}/vector_estimator.int8.onnx", vocoder=f"{M}/vocoder.int8.onnx",
    tts_json=f"{M}/tts.json", unicode_indexer=f"{M}/unicode_indexer.bin", voice_style=f"{M}/voice.bin")
tts = so.OfflineTts(so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(supertonic=cfg, num_threads=4)))

ffmpeg = subprocess.run(["node", "-e", "process.stdout.write(require('ffmpeg-static'))"],
                        cwd=ROOT, capture_output=True, text=True).stdout.strip()

def trim(x, sr, thr=0.004, pad=0.08):
    """앞뒤 무음을 걷어낸다. 클립의 시작이 곧 발화의 시작이어야 타임코드가 맞는다.
    처음엔 문턱 0.01·여유 30ms였는데 파열음 첫소리(바닥·깊이)가 잘려 인식이 깨졌다."""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    p = int(sr * pad)
    return x[max(0, idx[0] - p): idx[-1] + p]


# 처음엔 SenseVoice(다국어)를 썼는데, 자기 예제 한국어 음성조차 한자로 깨뜨렸다 — 검수 도구로 못 쓴다.
# 한국어 음성 코퍼스로 학습한 전용 모델로 바꿨다. 예제 음성을 글자 하나 틀리지 않고 받아 적는다.
K = next(iter(glob.glob(str(ROOT / "models/sherpa-onnx-zipformer-korean-*"))), None)
if not K and (search or check): sys.exit("인식기 모델이 없습니다. ./fetch-models.sh")
asr = K and so.OfflineRecognizer.from_transducer(
    encoder=f"{K}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{K}/decoder-epoch-99-avg-1.onnx",
    joiner=f"{K}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{K}/tokens.txt", num_threads=4)
DIG = "영일이삼사오육칠팔구"
def sino(n):
    """정수를 한자어 수사로 읽는다: 180 → 백팔십, 12262 → 만이천이백육십이"""
    if n == 0: return "영"
    out = ""
    for big, name in ((10**8, "억"), (10**4, "만")):
        if n >= big:
            q, n = divmod(n, big); out += ("" if q == 1 and name == "만" else sino(q)) + name
    for unit, name in ((1000, "천"), (100, "백"), (10, "십")):
        q, n = divmod(n, unit)
        if q: out += ("" if q == 1 else DIG[q]) + name
    return out + (DIG[n] if n else "")
UNITS = {"km": "킬로미터", "cm": "센티미터", "m": "미터"}
def hangul(s):
    s = re.sub(r"(?i)(km|cm|m)(?![a-z])", lambda m: UNITS[m.group().lower()], s)
    s = re.sub(r"\d[\d,]*", lambda m: sino(int(m.group().replace(",", ""))), s)
    return re.sub(r"[^가-힣]", "", s)
def cer(ref, hyp):
    r, h = hangul(ref), hangul(hyp)
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j-1] + 1, prev + (rc != hc))
    return d[len(h)] / max(1, len(r))


def synth(text, seed):
    g = so.GenerationConfig(); g.sid = VOICE_SID; g.speed = SPEED; g.extra = {"lang": LANG, "seed": seed}
    a = tts.generate(text, g)
    return trim(np.asarray(a.samples, dtype=np.float32), a.sample_rate), a.sample_rate

def recognize(x, sr):
    pad = np.zeros(int(sr * 0.3), np.float32)   # 갑자기 시작하는 음성은 첫 음절을 놓친다
    st = asr.create_stream(); st.accept_waveform(sr, np.concatenate([pad, x, pad])); asr.decode_stream(st)
    return st.result.text.strip()

seed_file = ROOT / "scenes" / scene / "voice-seeds.json"
chosen = json.loads(seed_file.read_text()) if seed_file.exists() and not search else {}

print(f"보이스 sid {VOICE_SID} · 속도 {SPEED}" + (" · seed 탐색" if search else ""))
print(f"{'파일':<8}{'seed':>5}{'구간':>6}{'실측':>7}{'여유':>7}{'오류':>6}   인식 결과")
over, bad = [], []
for line in spec["lines"]:
    f = line["file"]
    if search:
        scored = []
        for sd in SEEDS:
            x, sr = synth(line["text"], sd); scored.append((cer(line["text"], recognize(x, sr)), SEEDS.index(sd), sd))
        chosen[f] = min(scored)[2]
    sd = chosen.get(f, SEEDS[0])
    x, sr = synth(line["text"], sd)
    tmp = out / f".{f}"; sf.write(tmp, x, sr)
    subprocess.run([ffmpeg, "-y", "-i", str(tmp), "-ar", "48000", "-ac", "1", str(out / f)], capture_output=True, check=True)
    tmp.unlink()
    dur = len(x) / sr; slack = line["window"] - dur
    if slack < 0.15: over.append((f, dur, line["window"]))
    hyp, e = ("", float("nan"))
    if check or search:
        hyp = recognize(x, sr); e = cer(line["text"], hyp)
        if e > 0.15: bad.append((f, e))
    print(f"{f:<8}{sd:>5}{line['window']:>5.1f}s{dur:>6.2f}s{slack:>+6.2f}s{e:>6.0%}   {hyp}")

if search:
    seed_file.write_text(json.dumps(chosen, indent=2, ensure_ascii=False) + "\n")
    print(f"\nseed 기록 → {seed_file.relative_to(ROOT)}")
print(f"→ {out}")
if over:
    print(f"\n❌ 구간 여유 0.15초 미만 {len(over)}줄"); [print(f"   {f} {d:.2f}s / {w:.1f}s") for f, d, w in over]
if check or search:
    print("✅ 전 줄 인식 오류 15% 이하" if not bad else
          "⚠️ 인식 오류 15% 초과: " + ", ".join(f"{f}({e:.0%})" for f, e in bad) + " — 사람이 들어서 판정")
sys.exit(1 if over else 0)
