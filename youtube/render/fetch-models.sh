#!/usr/bin/env bash
# 나레이션 모델을 받는다. HuggingFace가 막힌 환경에서도 받을 수 있도록
# sherpa-onnx 공식 GitHub 릴리스를 쓴다. 모델 파일은 크기 때문에 커밋하지 않는다(models/는 gitignore).
#
#   Supertonic 3 (Supertone Inc.)  — 목소리. 코드 MIT / 모델 OpenRAIL-M. 한국어 지원, CPU로 충분
#   zipformer-korean (k2-fsa)       — 검수용 한국어 음성 인식. 목소리를 사람이 못 들을 때 받아 적어 대조한다
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p models
BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download

fetch() {  # fetch <tag> <name> <sha256|->
  local tag=$1 name=$2 sha=$3
  if [ -d "models/$name" ]; then echo "있음: $name"; return; fi
  echo "받는 중: $name"
  curl -fSL --retry 3 -o "models/$name.tar.bz2" "$BASE/$tag/$name.tar.bz2"
  if [ "$sha" != "-" ]; then
    echo "$sha  models/$name.tar.bz2" | sha256sum -c - || { echo "체크섬 불일치 — 중단"; rm -f "models/$name.tar.bz2"; exit 1; }
  fi
  tar xjf "models/$name.tar.bz2" -C models && rm "models/$name.tar.bz2"
}

fetch tts-models sherpa-onnx-supertonic-3-tts-int8-2026-05-11 82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427
fetch asr-models sherpa-onnx-zipformer-korean-2024-06-24 -

python3 -c "import sherpa_onnx, soundfile" 2>/dev/null || pip install sherpa-onnx soundfile
echo "완료. 사용: python3 tts_supertonic.py <씬> [--search|--check]"
