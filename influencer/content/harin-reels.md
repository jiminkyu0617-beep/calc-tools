# 하린 — 첫 릴스 10편

규칙: 첫 1초에 **숫자**. 5~8초. 화면 자막 한 줄. 모든 편 캡션 끝에 `#AI인물` 표기.
10편 중 3편(★)은 **댓글이 붙는 선택 주제** — 샘플에서 옷·음료 논쟁이 댓글을 만들었다.

| # | 첫 1초 장면 | 화면 자막 | 캡션 첫 줄 | 댓글 유도 질문 |
|---|---|---|---|---|
| 1 | 책상 위 빈 가계부 첫 장, 펜을 든다 | `D-30 · 오늘 쓴 돈 0원` | 월급 들어온 다음 날, 적기 시작했어요 | 월급날 제일 먼저 뭐 사요? |
| 2 | 편의점 영수증을 들어 보인다 | `오늘 12,400원 · 커피가 절반` | 커피 두 잔이 하루 지출의 반이었어요 | 커피값, 아껴요 vs 못 끊어요? ★ |
| 3 | 휴대폰 구독 목록 화면을 넘긴다 (화면은 흐리게) | `안 보는 구독 3개 = 월 27,700원` | 구독 정리하다가 놀랐어요 | 제일 안 쓰는 구독 하나만 말해줘요 |
| 4 | 점심 도시락 vs 식당 영수증 나란히 | `도시락 4,200원 / 사먹기 11,000원` | 일주일 도시락 싸봤어요 | 점심 도시락파 vs 사먹는파 ★ |
| 5 | 달력에 X 표시 3개, 한숨 | `무지출 3일째 · 오늘 무너짐` | 3일 만에 무너졌어요. 배달 앱 때문에 | 무지출 최고 기록 며칠이에요? |
| 6 | 계산모음 사이트의 4대보험 계산기 화면 | `월급 300만 원 → 4대보험 약 29만 원` | 내 월급에서 빠지는 돈부터 알아봤어요 | 월급명세서 제대로 본 적 있어요? |
| 7 | 장바구니에 담았다가 하나씩 빼는 손 | `장바구니 48,000원 → 19,000원` | 담았다 빼기만 10분 | 장바구니에 며칠째 있는 거 있어요? |
| 8 | 카페 창가, 텀블러 vs 일회용 컵 | `텀블러 할인 300원 × 20일` | 작은 거 모으면 6,000원 | 텀블러 들고 다녀요? ★ |
| 9 | 주간 점검 페이지를 펼친다 | `1주차 총 지출 187,300원` | 1주차 결산 해봤어요 | 한 주에 제일 많이 쓴 날은 무슨 요일? |
| 10 | 워크북을 들어 보인다 | `30일 지출 리셋 워크북` | 제가 쓰는 워크북 그대로 만들었어요 | 같이 30일 해볼 사람? |

> 6번은 계산기 화면이 실제 사이트다(`calculators/four-insurances.html`). 291,520원은 같은 저장소 001화 검산값.
> 10번이 판매 편. **1~9편으로 신뢰를 쌓은 뒤** 올린다 — 첫 편부터 팔면 광고 계정이 된다.

---

## 생성 프롬프트

모든 이미지 프롬프트 앞에 `characters/harin.md`의 **고정 외모 문장**을 붙이고, 기준 이미지를 참조로 넣는다.
공통 꼬리: `photorealistic, natural window light, shot on smartphone, vertical 9:16, no text, no logos`

| # | 이미지 (장면) | 영상 (움직임, 5초) |
|---|---|---|
| 기준 | `character reference sheet: front face, three-quarter view, full body, plain light grey background, wearing ivory knit cardigan over white t-shirt` | — |
| 1 | `sitting at a small desk in a studio apartment at night, holding a pen over an empty notebook, laptop and mug nearby, warm desk lamp` | `she opens the notebook, looks at the camera briefly, starts writing` |
| 2 | `standing outside a convenience store at dusk, holding up a small paper receipt toward the camera, wearing grey hoodie` | `she raises the receipt, tilts her head with a small embarrassed smile` |
| 3 | `sitting on the bed, looking at her phone with a surprised face, soft evening light` | `she scrolls slowly, eyebrows rise, she covers her mouth` |
| 4 | `office break room, two lunch options on the table: a homemade lunch box and a restaurant receipt` | `she points at the lunch box, then at the receipt, shrugs` |
| 5 | `at her desk, a wall calendar with three red X marks, food delivery bag on the floor, she sighs` | `she looks at the calendar, sighs, drops her head onto the desk` |
| 6 | `at her desk looking at a laptop screen showing a salary calculator page, blurred screen` | `she types, leans closer to the screen, nods slowly` |
| 7 | `holding a smartphone showing an online shopping cart, thumb hovering, blurred screen` | `she removes items one by one, exhales with relief` |
| 8 | `cafe window seat, a reusable tumbler and a disposable cup side by side, wearing navy blazer` | `she slides the disposable cup away and lifts the tumbler` |
| 9 | `at her desk, open notebook with a weekly summary page, calculator beside it` | `she taps the calculator, writes a number, circles it` |
| 10 | `holding a printed workbook toward the camera, cover facing camera but text blurred` | `she smiles and holds the workbook closer to the camera` |

> **이미지 먼저 → 확인 → 영상.** 얼굴이 기준 이미지와 다르면 영상으로 넘기지 않는다.
> 화면·영수증 속 글자는 생성 모델이 망가뜨린다. 글자는 **자막으로** 넣고, 생성 이미지 속 화면은 흐리게 둔다.
