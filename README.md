# 망고펫 MANGOPET

도트 펫을 3~7일 키워 도감을 모으는 미니 다마고치 앱입니다. 하루에 몇 번, 한 번에 10초 안팎으로 들여다보는 가벼운 육성 게임을 목표로 합니다.

지금은 **웹 베타** 단계입니다. 같은 게임을 감싼 아이폰·안드로이드 앱(예약 알림 포함)도 있습니다. 실행 방법은 [APP.md](APP.md)에 있습니다.

## 바로 해보기

| 페이지 | 주소 | 용도 |
|---|---|---|
| 베타 | https://aiden-mklee.github.io/mangopet/ | 실제 시간으로 흘러가는 휴대폰용 버전 |
| 랩 | https://aiden-mklee.github.io/mangopet/lab.html | 시간 빨리 감기, 케이스·버튼 시안 등 개발 패널이 붙은 버전 |

> 주소는 GitHub Pages를 켠 뒤에 열립니다. 켜는 방법은 아래 [배포](#배포)에 있습니다.

### 아이폰 홈 화면에 설치하기

1. **사파리**로 베타 주소를 엽니다.
2. 아래쪽 **공유** 버튼 → **홈 화면에 추가**를 누릅니다.
3. 홈 화면의 망고펫 아이콘으로 열면 주소창 없이 앱처럼 전체 화면으로 열립니다.

저장은 그 기기의 브라우저에만 됩니다. 알림과 위젯은 아직 없습니다.

## 폴더 구조

```
src/engine.js        ← 게임 규칙 (DOM·시계·Math.random 없음, 시드 랜덤). 나중에 Swift·Kotlin으로 옮길 대상
src/prototype.html   ← 화면·그림·입력. 빌드가 engine.js를 끼워 넣음
docs/                ← GitHub Pages로 배포되는 결과물 (tools/build.py가 생성, 직접 고치지 않음)
  index.html           베타 (실시간, 개발 패널·광고 없음, PWA)
  lab.html             랩 (개발 패널 포함)
  manifest.webmanifest, sw.js, icon-*.png
tools/
  build.py             폰트 서브셋 + docs/ 생성
  smoke.js             빌드 결과를 브라우저로 열어 오류 검사, 스크린샷은 .out/
  sim.js               가상 사용자 유형별 7일 시뮬레이션 (밸런스 확인용)
  golden.js            엔진 정답 테스트 (tests/golden.json과 비교). 다른 언어로 옮긴 엔진도 이 정답과 같아야 함
  fonts/Galmuri11.woff2  한글 픽셀 폰트 원본 (서브셋 재생성용)
app/                 아이폰·안드로이드 앱 (Capacitor). app/www는 빌드 결과물
assets/icons/        앱 아이콘 원본
licenses/            폰트 라이선스
CLAUDE.md            Claude 작업 지침
DESIGN.md            디자인 시스템 (케이스, LCD, 버튼, 색, 폰트)
GAME.md              게임 규칙과 밸런스 요약
APP.md               앱 실행 방법 (맥·Xcode, 안드로이드 스튜디오)
NEXT.md              앞으로 할 일 (우선순위 순)
```

## 개발

필요한 것: Python 3, Node 18+, `pip install fonttools brotli`, `npm install` (Playwright)

```bash
python3 tools/build.py     # src/prototype.html 수정 후 항상 실행 (폰트 서브셋 + docs/ 생성)
node tools/smoke.js        # 오류 검사, 스크린샷은 .out/
npm run serve              # http://localhost:8000 에서 docs/ 미리보기
node tools/golden.js       # 엔진 정답 테스트 (규칙을 일부러 바꿨으면 --update)
RUNS=10 node tools/sim.js  # 밸런스 시뮬레이션
```

글자를 하나라도 바꾸면 반드시 `tools/build.py`를 다시 돌려야 합니다. 화면 속 한글 픽셀 폰트는 쓰는 글자만 잘라 넣은 서브셋이라, 새 글자가 빠지면 그 글자만 다른 폰트로 보입니다.

## 배포

`main` 브랜치의 `docs/` 폴더가 그대로 GitHub Pages로 나갑니다. 처음 한 번만 설정합니다.

1. 저장소 **Settings → Pages**
2. **Build and deployment → Source**: `Deploy from a branch`
3. **Branch**: `main`, 폴더 `/docs` → **Save**

그 뒤로는 `docs/`가 바뀐 커밋을 `main`에 푸시하면 1~3분 안에 반영됩니다. 이미 설치한 사람도 다음에 열 때 새 버전을 받습니다.

## 관련 문서

- 기획서 (Claude Docs, 비공개): https://claude.ai/artifact/9BEh5TYxryJ7d6zmd7YV9Y
- 프로토타입 (Claude 아티팩트, 비공개): https://claude.ai/artifact/N3rjL1eRJT7p49EUMfgDuH
- 케이스 시안 (Figma): https://www.figma.com/design/VhjLkirgQSUoBIotlTMEZx

## 라이선스

- 한글 픽셀 폰트: [Galmuri](https://github.com/quiple/galmuri) © Lee Minseo, SIL Open Font License 1.1 ([licenses/Galmuri-OFL.md](licenses/Galmuri-OFL.md))
- 영문 픽셀 폰트: [Silkscreen](https://fonts.google.com/specimen/Silkscreen), SIL Open Font License 1.1 (Google Fonts에서 불러옴)
- 그 외 코드와 그림은 비공개 저작물입니다. 별도 라이선스를 정하기 전까지 무단 사용을 허락하지 않습니다.
