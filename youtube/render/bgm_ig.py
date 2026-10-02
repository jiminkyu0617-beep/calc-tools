#!/usr/bin/env python3
"""인스타 캐릭터 릴스용 따뜻한 BGM — 코드로 합성한다 (라이선스 불필요, 같은 명령 = 같은 파일).

유튜브 채널(한계선)의 베드는 55Hz 드론이다. 하린 계정은 "밤에 책상에서 가계부 쓰는" 톤이라
낮은 드론 대신 부드러운 전자피아노풍 코드 + 느린 아르페지오를 쓴다.
노래가 아니라 배경이다 — 나레이션이 나오면 build.mjs의 사이드체인이 눌러 준다.

릴스는 앱 안에서 유행 음원을 덧입히는 경우가 많다. 그럴 땐 이 파일 대신 앱에서 고른다.

사용: python3 bgm_ig.py [길이초=16] [출력=bgm/ig-warm.wav]
"""
import sys
from pathlib import Path
import numpy as np, soundfile as sf

SR = 48000
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 16.0
OUT = Path(__file__).resolve().parent / (sys.argv[2] if len(sys.argv) > 2 else "bgm/ig-warm.wav")
TARGET_PEAK_DB = -15.0   # 채널 베드(-24)보다 앞에 둔다. 브이로그는 음악이 분위기의 절반이다
import os
# 계정마다 결을 다르게: 템포와 조(반음 이동)만 바꾼다. 하린 84/0, 도윤 96/+2(조금 더 움직임), 세아 76/-3(더 느리고 낮게)
BPM = float(os.environ.get("IG_BPM", 84))
SHIFT = int(os.environ.get("IG_SHIFT", 0))
BEAT = 60 / BPM

def hz(midi): return 440 * 2 ** ((midi + SHIFT - 69) / 12)

# Fmaj7 → Em7 → Dm7 → Cmaj7 (내려가는 진행, 차분하고 밝다). 한 코드 = 4박
CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
ARP = [0, 2, 1, 3, 2, 1, 3, 2]   # 코드 음 순서 (8분음표)

t = np.arange(int(SR * DUR)) / SR
mix = np.zeros_like(t)

def ep(f, start, length, amp):
    """전자피아노풍 한 음: 사인 + 약한 2배음, 빠른 어택, 지수 감쇠"""
    i0 = int(start * SR); n = min(int(length * SR), len(t) - i0)
    if n <= 0: return
    tt = np.arange(n) / SR
    env = np.minimum(tt / 0.008, 1) * np.exp(-tt / (length * 0.35))
    tone = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.25)
    mix[i0:i0 + n] += amp * env * tone

bar = 4 * BEAT
k = 0
while k * bar < DUR:
    ch = CHORDS[k % len(CHORDS)]
    s = k * bar
    # 패드: 코드 전체를 길게, 부드럽게 (어택 0.35초)
    for m in ch:
        i0 = int(s * SR); n = min(int((bar + 0.6) * SR), len(t) - i0)
        if n <= 0: continue
        tt = np.arange(n) / SR
        env = np.minimum(tt / 0.35, 1) * np.minimum(1, np.maximum(0, (bar + 0.6 - tt) / 0.6))
        det = np.sin(2 * np.pi * hz(m) * tt) + np.sin(2 * np.pi * hz(m) * 1.003 * tt)
        mix[i0:i0 + n] += 0.07 * env * det
    # 베이스: 근음 한 옥타브 아래, 첫 박과 셋째 박
    for b in (0, 2):
        ep(hz(ch[0] - 12), s + b * BEAT, 1.2, 0.30)
    # 아르페지오: 한 옥타브 위, 8분음표
    for j, idx in enumerate(ARP):
        ep(hz(ch[idx] + 12), s + j * BEAT / 2, 0.9, 0.11 if j % 2 else 0.14)
    k += 1

# 고역을 살짝 깎아 따뜻하게 (1차 저역통과, 약 3.5kHz)
a = np.exp(-2 * np.pi * 3500 / SR); y = np.empty_like(mix); acc = 0.0
for i, v in enumerate(mix):
    acc = (1 - a) * v + a * acc; y[i] = acc
# 앞뒤 페이드
fi, fo = int(0.3 * SR), int(1.2 * SR)
y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
y *= 10 ** (TARGET_PEAK_DB / 20) / np.max(np.abs(y))
OUT.parent.mkdir(parents=True, exist_ok=True)
sf.write(OUT, y.astype(np.float32), SR, subtype="PCM_16")
print(f"→ {OUT}  {DUR:.1f}초 · 피크 {TARGET_PEAK_DB} dBFS")
