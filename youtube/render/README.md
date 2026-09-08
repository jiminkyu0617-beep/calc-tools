# 렌더 파이프라인

채널 **한계선**의 모든 화면은 여기서 나온다. 외부 자료화면을 쓰지 않는다.

```
scene.html (HTML/CSS/JS)  →  Chromium 프레임 캡처  →  ffmpeg  →  1080×1920 MP4
```

## 왜 코드로 그리는가

무출연 채널의 진짜 병목은 소재가 아니라 **자료화면**이다.
남의 화면을 짜깁기하면 저작권 위험이 따라오고, 무엇보다 **대체 가능한 채널**이 된다.
직접 그리면 둘 다 해결된다. 그리고 코드로 그리면 세 가지가 더 따라온다.

1. **결정론적이다.** CSS 애니메이션도 `requestAnimationFrame`도 쓰지 않는다.
   모든 움직임이 `render(t)` 하나에서 나오고, 캡처는 t를 직접 넣는다.
   같은 씬은 몇 번을 렌더해도 프레임 단위로 동일하다.
   → **"영상미를 조금 고쳐서 다시 뽑는다"가 실제로 가능하다.** 피드백 루프의 전제다.
2. **룩이 문서가 아니라 파일이다.** `theme.css`가 룩북의 구현체다.
   룩을 바꾸면 다시 렌더하는 전 회차가 같이 바뀐다. 문서와 결과물이 어긋날 수 없다.
3. **자막을 두 번 적지 않는다.** 씬의 `captions` 배열이 원본이고,
   `.srt`는 거기서 생성한다. 대본과 화면의 타임코드가 어긋날 수 없다.

## 설치

```bash
cd youtube/render
npm install
```
Chromium은 이 환경에 이미 설치돼 있다(`PLAYWRIGHT_BROWSERS_PATH`).
`lib/chrome.js`가 리비전을 알아서 찾으므로 경로를 손댈 필요가 없다.

## 사용

```bash
node capture.mjs 001-deepest-hole            # 프레임 PNG 시퀀스
node build.mjs   001-deepest-hole            # 무음 MP4
node build.mjs   001-deepest-hole vo.wav     # 나레이션 포함 (-14 LUFS 자동 정규화)
node srt.mjs     001-deepest-hole            # 업로드용 자막
```

전체 렌더 전에는 **반드시 키프레임을 먼저 눈으로 본다.**
1710프레임을 다 뽑고 나서 색이 틀린 걸 발견하면 그만큼을 버린다.

```bash
node _preview.mjs 001-deepest-hole "3.6,17.5,44,52.8"
```

## 새 회차 만들기

1. `scenes/<번호>-<슬러그>/scene.html` 생성
2. `theme.css`를 링크하고 `lib/scene.js`를 import
3. `defineScene({ duration, fps: 30, captions, render(t) })` 하나만 구현
4. 미리보기 → 비주얼 QC(`04-visual.md`) → 전체 렌더

**`render(t)` 안에서 시간을 읽지 마라.** `Date.now()`, `Math.random()`, CSS transition 전부 금지다.
하나라도 들어가면 결정론이 깨지고, 그 순간 재현이 불가능해진다.

## 구조

| 파일 | 역할 |
|---|---|
| `theme.css` | 디자인 토큰. **룩북의 구현체** |
| `lib/scene.js` | 씬 런타임 — 이징, 보간, 카운트업, 자막 |
| `lib/chrome.js` | Chromium 실행 파일 탐색 |
| `lib/serve.js` | 정적 서버 (`file://`에서는 모듈 스크립트가 CORS로 막힌다) |
| `capture.mjs` | 프레임 캡처 |
| `build.mjs` | ffmpeg 조립 |
| `srt.mjs` | 자막 생성 |
| `_preview.mjs` | 키프레임 미리보기 |

## 발행 규격

1080×1920 / 30fps / H.264 High CRF 18 / yuv420p / AAC 192k / -14 LUFS

## 라이선스

- **Pretendard** — OFL. 임베딩·재배포 가능
- **생성물** — 전부 자체 제작. 외부 소스 0건
