# APP.md: 아이폰·안드로이드 앱

웹 게임을 [Capacitor](https://capacitorjs.com)로 감싼 진짜 앱입니다. 게임 코드는 웹과 같고, 앱에서만 **예약 알림**이 동작합니다.

## 구조

```
capacitor.config.json   앱 이름, 앱 ID, 폴더 위치
app/www/                앱에 들어가는 화면 (tools/build.py가 생성, 직접 고치지 않음)
app/ios/                Xcode 프로젝트 (Swift Package Manager 사용, CocoaPods 불필요)
app/android/            Android Studio 프로젝트
```

## 알림이 동작하는 방식

1. 앱을 닫거나 다른 앱으로 넘어가면, 엔진의 `forecast`로 "아무도 안 들어오면 앞으로 7일 동안 갈 알림"을 계산해 폰에 예약합니다 (최대 60개).
2. 앱으로 돌아오면 예약을 모두 지우고, 닫혀 있던 시간만큼 게임을 따라잡습니다 (최대 14일).
3. 다시 닫을 때 바뀐 상태로 다시 예약합니다.

랜덤이 시드 방식이라 예약한 알림과 실제로 일어나는 일이 분 단위로 같습니다. 알림 권한은 처음 알을 받을 때 묻습니다. 웹 랩의 "알림 기록 → 지금 닫으면?"으로 예약될 알림을 미리 볼 수 있습니다.

## 아이폰에서 실행하기 (맥 필요)

처음 한 번:

1. 맥 앱스토어에서 **Xcode**를 설치하고 한 번 실행해서 추가 구성요소 설치를 끝냅니다.
2. [Node.js](https://nodejs.org) LTS를 설치합니다.
3. 터미널에서:
   ```bash
   git clone https://github.com/aiden-mklee/mangopet.git
   cd mangopet
   npm install
   npm run ios        # 웹 화면을 앱에 복사하고 Xcode를 엽니다
   ```
4. Xcode 왼쪽에서 **App** 프로젝트 → **Signing & Capabilities**:
   - **Team**: `Add an Account…`로 애플 ID 로그인 → `(Personal Team)` 선택. 개발자 계정(유료) 없이 됩니다.
   - **Bundle Identifier**: `com.emango.pet` 그대로 둡니다. 무료 계정에서 "이미 쓰이고 있다"고 나오면 잠깐 `com.emango.pet.dev`처럼 바꿔서 테스트합니다.
5. 아이폰을 케이블로 연결하고, 아이폰 **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 켭니다 (재시동 필요).
6. Xcode 위쪽에서 기기를 내 아이폰으로 고르고 ▶ 버튼.
7. 처음 실행하면 아이폰에서 "신뢰할 수 없는 개발자"가 뜹니다. **설정 → 일반 → VPN 및 기기 관리**에서 내 애플 ID를 신뢰합니다.

그 뒤로는 아래 세 줄 → Xcode에서 ▶ 만 하면 됩니다.

```bash
cd ~/mangopet
git pull
npm run ios
```

**무료(Personal Team)의 제한**
- 설치한 앱은 **7일 뒤 열리지 않습니다.** 다시 ▶ 하면 됩니다 (저장 데이터는 남아 있음).
- 친구 폰에는 설치할 수 없습니다. 친구에게 나눠주려면 애플 개발자 계정(연 $99)과 TestFlight가 필요합니다.

## 안드로이드에서 실행하기 (맥 없어도 됨)

1. [Android Studio](https://developer.android.com/studio)를 설치합니다.
2. `npm install` 후 `npm run android` → Android Studio가 열리면 폰을 연결하거나 에뮬레이터를 고르고 ▶.
3. 친구에게 줄 때는 **Build → Build App Bundle(s) / APK(s) → Build APK(s)**로 만든 APK 파일을 보내면 됩니다 (구글 계정 불필요).

## 화면을 고친 뒤

```bash
python3 tools/build.py   # docs/와 app/www/를 다시 만듭니다
npx cap sync             # app/www/를 iOS·안드로이드 프로젝트에 복사합니다
```

`npm run app`이 이 둘을 한 번에 합니다.

## 출시 전에 정할 것

- **앱 ID** (`capacitor.config.json`의 `appId`): `com.emango.pet`. 망고 시리즈는 `com.emango.*`로 통일합니다 (가계부는 `com.emango.log` 예정). 스토어에 올리면 바꿀 수 없으니, 개발자 계정 가입 때 이 이름으로 등록합니다.
- 앱 아이콘과 시작 화면 (지금은 Capacitor 기본 그림)
- 위젯: Swift(아이폰), Kotlin(안드로이드)으로 따로 만듭니다. 규칙은 `src/engine.js`를 옮기고 `tools/golden.js`의 정답과 맞춥니다.
