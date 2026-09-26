/* Chromium 실행 파일을 찾는다.
   playwright-core의 기본 해석은 패키지 버전과 설치된 리비전이 어긋나면 실패한다.
   이 환경은 브라우저가 미리 깔려 있으므로(PLAYWRIGHT_BROWSERS_PATH) 직접 찾는다. */
import { globSync } from 'node:fs';
import { chromium } from 'playwright-core';

export function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  // 풀 chromium을 우선한다. headless_shell은 폰트·렌더 옵션 지원이 좁아 대비책으로만 쓴다.
  const full  = globSync(`${base}/chromium-*/chrome-linux/chrome`).sort();
  const shell = globSync(`${base}/chromium_headless_shell-*/chrome-linux/headless_shell`).sort();
  const found = full.length ? full : shell;
  if (found.length) return found.at(-1);             // 리비전이 여럿이면 최신
  try { return chromium.executablePath(); } catch { return undefined; }
}
