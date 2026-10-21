# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 폴더는

D6 수업("무료 API로 나만의 서비스 만들기") 자료 폴더예요. 빌드·린트·테스트 도구가 없고, 결과물은 **HTML 파일 하나**를 더블클릭으로 여는 화면이에요. git 저장소가 아니에요.

- `D06_1021.html` — 수업 워크북. 미션 A~D 프롬프트, 검사 4가지, 오후 개인 미션(`my-service` 레포, Issue → PR, GitHub Pages) 흐름이 모두 여기에 있어요. 미션 요청이 오면 먼저 여기서 해당 미션을 찾아 의도를 확인해요.
- `API_주문_시뮬레이터.html` — JSON에서 값 꺼내기(`data.rates.KRW`) 연습용 교구.
- `d6-api/` — 미션 결과물(`weather.html` ★, `rate.html` ★, `city.html` ★★, `morning.html` ★★★). 새 화면을 만들 때 이 파일들의 CSS 토큰·`.card`·`.error`·`.api-box` 구조를 그대로 따라 해요.
- `.claude/skills/api-check/` — `/api-check <파일>`: 규칙대로 검사만 하고 고치지 않는 스킬(fork로 실행).
- `api/bus.js` + `d6-api/businformation.html` — 키가 필요한 API(서울 버스)의 예외. 화면은 같은 사이트의 `/api/bus`만 부르고, Vercel 서버 함수가 환경 변수 `SEOUL_BUS_KEY`로 서울시 API를 대신 불러요. Vercel에서만 동작해요(GitHub Pages·더블클릭은 안내 문구만 나옴). 키는 코드·커밋·대화 어디에도 넣지 않고 Vercel 대시보드 환경 변수에만 둬요. 새 주문을 받으려면 `OPS` 허용 목록에 추가해요.
- 같은 방식(Vercel 서버 함수 + 환경 변수)인 화면이 두 개 더 있어요. `api/unsplash.js` + `d6-api/moodboard.html`(환경 변수 `UNSPLASH_ACCESS_KEY`, GET `?query=&page=`), `api/uxwriting.js` + `d6-api/UXwriting.html`(환경 변수 `GEMINI_API_KEY`, 선택 `GEMINI_MODEL` 기본 `gemini-3.5-flash-lite` — `gemini-3.8-flash`는 무료 등급이 하루 20번뿐). UX 라이팅 주문서(프롬프트)와 JSON 모양은 서버 함수 안에 있고, 화면은 상황·유형·톤만 POST로 보내요. 다른 사이트에서 온 요청(Origin 다름)은 막아요.

배포: GitHub `junhyunu/6day_project`(Public) → GitHub Pages(정적 화면)와 Vercel(서버 함수 포함)에 함께 연결해서 써요. push하면 둘 다 다시 배포돼요.

## API 화면 규칙

API를 쓰는 화면을 만들거나 고칠 때는 아래 규칙을 지켜요. `/api-check`도 같은 파일을 기준으로 검사해요.

@.claude/rules/api.md

## 확인하는 방법 (테스트 대신)

- **API 응답·CORS 확인:** `curl -s "<주소>"`로 응답 모양을 보고, `curl -s -D - -o /dev/null -H "Origin: null" "<주소>"`에 `access-control-allow-origin: *`가 있어야 더블클릭(file://)으로 연 화면에서도 불러와져요.
- **화면 렌더 확인:** 헤드리스 크롬으로 fetch가 끝난 뒤의 DOM을 뽑아요.
  `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir=<스크래치 폴더> --virtual-time-budget=15000 --dump-dom "file:///<파일 경로>"`
- **카드 하나만 실패시키기:** 원본은 두고 스크래치 폴더에 복사본을 만든 뒤 `sed`로 🔌 주소 하나만 틀리게 바꿔 렌더해요. 나머지 카드가 그대로 보여야 해요.
- 파이썬으로 한글·이모지를 출력할 때는 `PYTHONIOENCODING=utf-8`을 붙여요(기본 cp949라 오류가 나요).

## 수업 API에서 실제로 겪은 함정

- **Frankfurter:** `api.frankfurter.app`은 `api.frankfurter.dev/v1`로 301 리다이렉트돼요. 새 주소를 써요. `amount=` 파라미터를 쓰면 결과가 정수로 반올림되니, 1단위 환율을 받아 화면에서 곱해요. `date`는 유럽중앙은행의 하루 한 번 기준값이에요.
- **Open-Meteo 지오코딩:** 한글 짧은 이름이 자주 틀려요("서울" → 결과 없음, "구리" → 북한, "부산" → 의성군 마을). 정식 이름("서울특별시", "구리시")은 맞아요. `count`를 늘려 `population`이 가장 큰 곳을 고르고, 찾은 곳 이름과 다른 후보 선택지를 화면에 보여 줘요.
- **Open-Meteo 대기질:** 측정소 값이 아니라 CAMS 예보 모델 값이에요. 환경부 등급(PM10 30/80/150, PM2.5 15/35/75 이하 기준)을 쓰더라도 "에어코리아 측정값과 다를 수 있다"고 적어요.
- **Nager.Date:** 공휴일 이름은 `localName`(한국어)으로 보여 줘요. `name`은 영어예요.
- **Dog CEO:** 사진은 `images.dog.ceo`에서 따로 오니 `<img onerror>`로 사진 실패도 처리해요.
