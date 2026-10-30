# CLAUDE.md

망고펫(MANGOPET)은 도트 펫을 3~7일 키워 도감을 모으는 미니 다마고치 앱이다. 1인 개발이고, 지금은 웹 베타로 감을 잡는 단계다. 사용자와는 한국어로 대화한다.

## 먼저 읽을 것

- `NEXT.md`: 앞으로 할 일. 사용자가 "뭐 하지?", "다음은?"이라고 물으면 여기 맨 위부터 답한다. 일을 끝내거나 계획이 바뀌면 같은 커밋에서 `NEXT.md`도 고친다.
- `README.md`: 구조, 빌드, 배포
- `DESIGN.md`: 케이스·LCD·버튼·색·폰트 규칙과 지금까지 정해진 디자인 결정
- `GAME.md`: 게임 규칙과 밸런스 수치

## 작업 방식

- **원본은 두 파일이다.** `docs/`는 빌드 결과물이라 직접 고치지 않는다.
  - `src/engine.js`: 게임 규칙만. DOM, 시계(`Date`, `performance`), `Math.random`을 쓰지 않는다. 랜덤은 저장 상태의 `g.seed`로 돌리는 `E.rand(g)`만 쓴다. 그래야 같은 저장은 항상 같은 결과가 나오고, 앱을 닫을 때 앞으로 올 알림을 미리 계산(`E.forecast`)할 수 있다. 나중에 Swift·Kotlin으로 옮길 대상도 이 파일이다.
  - `src/prototype.html`: 화면, 그림, 입력. 규칙은 `E.xxx(g)`로 부르고, 엔진이 돌려주는 이벤트(`notice`, `hatchReady`, `evolve`, `charm` …)를 `onEvent`에서 화면 연출로 바꾼다. `<html>`/`<head>`가 없는 조각이고, 엔진 자리(`@engine` 주석)에 빌드가 `engine.js`를 끼워 넣는다. claude.ai 아티팩트로 올릴 때는 `.out/artifact.html`을 쓴다.
- 규칙(수치, 성장, 알림 정책)을 바꾸는 건 `engine.js`에서, 보이는 것만 바꾸는 건 `prototype.html`에서 한다.
- 수정한 뒤에는 항상 순서대로 실행한다.
  1. `python3 tools/build.py`: 한글 폰트 서브셋을 다시 만들고 `docs/`를 생성한다. 글자를 하나라도 바꿨다면 필수다.
  2. `node tools/smoke.js`: 베타와 랩을 브라우저로 열어 오류가 없는지 보고, `.out/`에 스크린샷을 남긴다.
  3. `node tools/golden.js`: 엔진이 정해진 시나리오에서 예전과 똑같이 움직이는지 본다. 규칙을 일부러 바꿨다면 `--update`로 정답(`tests/golden.json`)을 새로 쓰고, 커밋 메시지에 무엇이 달라졌는지 적는다.
- 화면이 바뀌는 작업이면 스크린샷을 직접 보고 확인한 뒤에 끝났다고 말한다.
- `tools/build.py`는 원본의 특정 문자열(제목, 저장 키, `REALTIME`·`ADS` 스위치, `fresh()` 첫머리, `[hidden]` 규칙, 광고 자리, `requestAnimationFrame(loop);`)을 찾아 바꾼다. 이 부분을 고치면 빌드 스크립트도 같이 고친다. 못 찾으면 빌드가 멈춘다.
- 밸런스를 바꾸면 `RUNS=10 node tools/sim.js`로 사용자 유형별 결과를 다시 보고, `GAME.md`의 수치도 맞춰 고친다.

## 코드 지도

- 화면: 48 × 46칸 LCD. 놀이 공간 48 × 32(`LW`, `LH`, 바닥 `GND`) + 위아래 아이콘 줄. 픽셀 버퍼는 `Pix` 클래스.
- 그림: `RAW`(스프라이트 문자열), `ICONS`(6 × 6 아이콘), `buildAdult(line, animal)`이 성체 24종을 조합해서 만든다(달리기용 작은 그림은 `buildRunner`). 표정은 `moodRows`.
- 엔진(`src/engine.js`): 데이터 `CON`(체질), `LINES`·`ANIMALS`·`SP`(종), `PATTERNS`(가보 무늬 이름), `NOTIF`(알림 빈도). 1분 진행 `E.step`, 건너뛰기 `E.advance`, 행동 `E.meal/snack/med/clean/pet/playDone/visit`, 생애 `E.newPet/hatch/graduate`, 알림 예측 `E.forecast`.
- 화면(`src/prototype.html`): `SKINS`(케이스 색), `CASES`(케이스 상품), `BGS`(배경), `CHARMS`(키링 참 그림), `ACC`(가보 무늬 그림, 몸에 새기는 위치는 `patPoints`), `HATS`(소품 모자, `hatted`가 머리 위에 얹고 `dressed`가 무늬+모자를 입힌 그림을 돌려줌. 저장은 `g.hat`).
- 상태: 전역 `g`(저장되는 게임 상태, 엔진이 읽고 쓴다)와 `ui`(화면 상태). 화면 쪽 `stepMinute()`/`advance(min)`은 엔진을 부르고 이벤트를 처리하는 얇은 감싸개다.
- 첫 실행: `g.intro`(case → life → egg → meal → pet → clean → charm → done), `introTo`/`introDid`/`introSkip`, 시트는 `openZoom('intro-…')`.
- 행동: `act(a)`, `petTap()`, `crackEgg()`, 메뉴는 `openMenu()`/`closeMenu()`/`menuClick`, 방향키는 `nav(dx, dy)`. 기기 위 HTML 창에서는 방향키 커서 `padMove`/`padChoose`.
- 꾸미기 모드: `openDeco(tab)`/`closeDeco()`, 미리보기 `decoPreview`, 확정 `decoKept`. 픽셀 배경은 `Scene`(`SCENES`에 장면 추가). 도트 케이스는 `PxCase`(`queue()`로 다시 그림).
- 처음 며칠: 엔진 `E.appDay`(앱을 쓴 날수), 화면 `OPENS`·`opened(k)`·`openNews`. 주운 것은 엔진 `FINDS_FROM`.
- 하는 일과 주운 것: `DOING`(시간대별 장면, `ui.doing`, `doingStart`), 엔진 `FINDS`·`E.pickUp`, 그림 `FIND_SPR`, 놓인 것 `g.found`, 모은 것 `g.finds`.
- 이름: `g.name`(엔진 `newPet`에서 비움, 알림 제목 `who`, 키운 기록 `hist[].name`), 화면 `giveName`(부화 때 랜덤 이름)·`openZoom('name')`(바꾸기)·`nameSubj()`.
- 특별한 날: `FEST`·`fest()`(폰 날짜, 생일 `g.birthday`)·`festDraw`·`festGreet`(`g.festSeen`).
- 친구와 놀기: `visitCode`/`readVisit`/`welcomeGuest`/`sendVisit`, 손님 `g.guest`(하루), 그림 `guestSprite`.
- 오늘의 일기: `diaryOpen`(하루 첫 열기)·`diaryNote`, 저장 `g.diary`.
- 성장 힌트: `growthHint`(하루 한 번, `E.lineOdds`, `g.hintDay`).
- 나를 알아보기: 엔진 `g.unseen`(깨어 있는 동안 아무것도 안 해 준 분), 화면 `moodOnOpen`·`ui.greet`·`ui.sulk`·`backView`.
- 앱 안 알림: 말하는 창 `talk(제목, 한 줄, 큰 소식?)`(큰 소식은 `talkQ`에 줄 서고 `talkNext`로 넘김, 선택·취소 버튼이 먼저 넘김). `banner(text)`는 가벼운 말로 `talk`를 부른다.
- 화면 속 설정과 도감: `renderScreen(tab, el)`, 크게 보기 창은 `openZoom`(탭 순서 도감·주운 것·앨범). 액정의 도감 아이콘은 "무엇을 볼까요?"(`ui.bookAsk`)로 도감(`drawDexLCD`)·주운 것(`drawFindsLCD`, `FIND_ORDER`) 중 골라 ◀ ▶로 넘긴다.
- 저장: `localStorage`. 키는 원본 `dotpet-proto-v1`, 베타 `mangopet-beta-v1`, 랩 `mangopet-lab-v1`. 이미 나간 키를 바꾸면 사용자 데이터가 사라지므로, 바꿀 때는 옛 키를 읽어 옮기는 코드를 같이 넣는다.

## 지켜온 원칙 (사용자가 정한 것)

- **가볍게.** 시간을 뺏지 않는다. 알림은 하루 3~4개 이하, 한 번 열면 10초 안팎.
- **기기 밖 UI는 최소로.** 고르는 화면(새 알, 죽음·부활, 설정, 도감)은 모두 LCD 안의 픽셀 폰트 메뉴로 띄운다. 기기 아래에는 "설정"과 "도감 크게 보기" 버튼 정도만 둔다.
- **조작:** 아이콘을 누르면 커서만 옮기고, 실행은 선택 버튼으로 한다. "한 번 탭으로 실행"은 설정에서 켜는 옵션이다.
- **재촉하는 깜빡임 금지.** 버튼을 깜빡이며 재촉하는 연출은 싫어한다. "한 번 더 누르면 실행" 같은 안내 문구도 빼기로 했다. 펫 주변 효과처럼 느긋하게 깜-빡-깜-빡 하는 정도는 괜찮다.
- **설명은 짧게.** 화면에 상세 수치를 늘어놓지 않는다. 확률은 "높아요" 정도로 말하고, 결과는 마지막에 랜덤으로 정한다.
- **화면은 바뀌어도 기기는 그대로.** 설정과 도감은 기기를 뒤집거나 다른 화면으로 가지 않고 액정 자리에서 열린다. 뒤집는 애니메이션은 어색하다는 평이었다.
- **레트로 LCD 감성.** 칸 사이 틈이 살짝 보이고, 꺼진 픽셀도 연하게 보인다. 아이콘과 펫은 같은 격자를 쓴다(크기가 다르면 어색하다).
- **첫 알만 톡톡 눌러 깬다.** 처음 받은 알은 1분마다 한 단계씩 저절로 금이 가고(5단계면 부화), 누르면 더 빨리 깨진다. 알은 좌우로 흔들지 않고 위아래로 꿍실꿍실 숨 쉰다.

## 하지 않기로 한 것

- 대충 픽셀로 깎은 케이스 (너무 이상하다는 평). 지금의 도트 케이스는 명암·디테일을 제대로 넣어 다시 만든 것
- 케이스에 따로 붙인 고리 귀(케이스마다 손이 감), 하트 케이스, 레고 브릭 알(보류)
- 반투명 케이스 (예쁘지만 무광이 낫다는 결론)
- 알 모양 컴팩트 케이스: 액정이 알 테두리에서 벗어나 보임. 컴팩트는 네모로
- 블록(마인크래프트풍) 케이스: 풀·나무·망고 블록 시안을 봤지만 생각한 느낌이 아니었다
- 기기 아래쪽의 상세 설명 글, 영문 픽셀 라벨
- 이름 후보였던 도트펫(같은 이름 앱이 있음), 망고치, 망고몬(디지몬 느낌), 토독, 토도독(투두 느낌)
- 걸음 수 연동 (보류)

## 앱 (Capacitor)

- `app/www/`는 빌드가 만든다. 화면을 고쳤다면 `python3 tools/build.py` 뒤에 `npx cap sync`로 아이폰·안드로이드 프로젝트에 복사한다. 자세한 건 `APP.md`.
- 앱에서만 예약 알림을 건다 (`scheduleAhead`/`scheduleSoon`, 엔진의 `forecast`. 앱이 켜져 있는 동안에도 1분마다, 행동할 때마다 다시 예약). 웹에서는 아무 일도 하지 않는다.
- 이 리눅스 환경에서는 아이폰 빌드를 못 한다. 아이폰 실행은 사용자의 맥에서 한다.
- **테스트 모드**: 지금 앱은 `capacitor.config.json`의 `server.url`로 GitHub Pages의 `docs/app.html`을 불러온다. 게임만 고친 경우엔 `main`에 올리면 사용자가 앱을 껐다 켜는 것으로 끝난다 (Xcode 불필요). 앱 껍데기(플러그인, 아이콘, 이름, 설정)를 바꿨을 때만 맥에서 `git pull` → `npm run ios` → ▶가 필요하다고 안내한다. 출시 전에는 `server`를 지운다.

## 사용자에게 명령어를 줄 때

- 사용자는 맥에서 망고펫과 망고로그를 오가며 작업한다. 터미널 명령어를 줄 때는 **항상 첫 줄에 `cd ~/mangopet`**을 넣는다 (저장소는 맥의 `~/mangopet`에 있다).
- 앱을 다시 설치하는 기본 묶음:
  ```bash
  cd ~/mangopet
  git pull
  npm run ios
  ```
  그다음 Xcode에서 ▶.

## 커밋과 배포

- `main`의 `docs/`가 GitHub Pages로 배포된다. 원본을 고친 커밋에는 빌드된 `docs/`도 같이 넣는다.
- 커밋 메시지는 짧은 한국어나 영어 명령형으로 쓰고, 무엇을 왜 바꿨는지 적는다.
