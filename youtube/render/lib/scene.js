/* ─────────────────────────────────────────────────────────────
   씬 런타임 — 결정론적 렌더의 핵심

   CSS 애니메이션도 requestAnimationFrame도 쓰지 않는다.
   모든 움직임은 render(t) 하나에서 나오고, 캡처는 t를 직접 넣는다.
   그래서 같은 씬은 몇 번을 렌더해도 프레임 단위로 동일하다.
   이게 안 되면 "영상미를 조금 고쳐서 다시 뽑는다"가 불가능해진다.
   ───────────────────────────────────────────────────────────── */

export const W = 1080;
export const H = 1920;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, p) => a + (b - a) * p;

/** t가 [from, to] 구간에서 진행한 정도를 0~1로. 구간 밖은 0 또는 1로 잘린다. */
export const seq = (t, from, to) => clamp((t - from) / (to - from));

/** 이징 — 모션 변수는 룩북에 고정돼 있다. 씬마다 다른 곡선을 쓰지 않는다. */
export const ease = {
  out:   p => 1 - Math.pow(1 - p, 5),        // 기본. 빠르게 들어와 부드럽게 멈춘다
  inOut: p => p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2,
  linear:p => p,
};

/** 숫자 카운트업. 자릿수가 흔들리지 않게 tnum과 함께 쓴다. */
export const counter = (t, from, to, a, b, digits = 0) =>
  lerp(from, to, ease.out(seq(t, a, b))).toLocaleString('ko-KR', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

export const $ = sel => document.querySelector(sel);
export const $$ = sel => [...document.querySelectorAll(sel)];

/** 요소를 t 구간에 맞춰 페이드+슬라이드로 등장시킨다. 전 씬 공통 동작. */
export function reveal(el, t, from, to, { y = 40, out = null } = {}) {
  const p = ease.out(seq(t, from, to));
  let o = p;
  if (out !== null) o = Math.min(p, 1 - ease.out(seq(t, out, out + 0.3)));
  el.style.opacity = o;
  el.style.transform = `translateY(${lerp(y, 0, p)}px)`;
}

/**
 * 씬 정의. duration(초)과 render(t) 하나만 있으면 된다.
 * capture.mjs가 window.__scene을 읽어 프레임을 뽑고,
 * srt.mjs가 captions를 읽어 자막 파일을 만들고,
 * vo.mjs가 narration을 읽어 나레이션 대본과 타임코드 명세를 만든다.
 * 자막·나레이션·화면의 원본이 이 파일 하나다. 세 군데에 적으면 반드시 어긋난다.
 */
export function defineScene({ duration, fps = 30, render, captions = [], narration = [] }) {
  window.__scene = {
    duration, fps, captions, narration,
    frames: Math.round(duration * fps),
    seek(frame) {
      render(frame / fps);
      return frame;
    },
  };
  render(0);
}
