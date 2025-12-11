# 최고의 동작구청장 후보는 누구? - 동작구청장 후보 캠프

동작구 불법 주정차 문제를 해결하기 위한 초등학생용 인터랙티브 웹 애플리케이션입니다.

## 주요 기능

### 📋 단계별 학습 과정

1. **0단계**: 이름 입력 및 시작
2. **1단계**: 데이터 시각화 (연도별/월별 불법 주정차 민원 현황)
3. **2단계**: 데이터 분석 문제 풀기
4. **3단계**: 문제의 원인 생각하기
5. **4단계**: 공약 쓰기 및 AI 피드백
6. **5단계**: 동료 평가/투표
7. **6단계**: 1등 해결방안 연설문 자동 생성
8. **7단계**: 개인 대시보드

### 🎨 디자인 특징

- 파란 계열의 겨울 테마 스타일
- 눈이 편안한 색상 구성
- 반응형 디자인 (모바일 지원)

### 🤖 AI 기능

- ChatGPT API를 활용한 문장 연결 및 다듬기
- 초등학생 4학년 수준에 맞춘 피드백 제공
- 1등 해결방안 자동 연설문 생성

## 설치 및 실행

### 1. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# OpenAI API Key
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

`.env.example` 파일을 참고하여 필요한 환경변수를 설정하세요.

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 빌드

```bash
npm run build
```

## Firebase Realtime Database 연동

이 프로젝트는 Firebase Realtime Database를 사용하여 여러 학생의 데이터를 실시간으로 공유합니다.

### 설정 완료

Firebase 설정은 이미 완료되었습니다:
- `src/firebase.js` 파일에 Firebase 설정 포함
- 제안 저장/불러오기: Firebase Realtime Database 사용
- 투표 저장/불러오기: Firebase Realtime Database 사용
- 실시간 업데이트: 5단계에서 다른 학생의 제안이 추가되면 자동 업데이트

### Firebase 패키지 설치

```bash
npm install firebase
```

### 데이터 구조

**proposals** (제안):
```
proposals/
  {proposalId}/
    name: string
    problem: string
    solution: string
    reason: string
    combinedText: string
    text: string
    timestamp: string
```

**votes** (투표):
```
votes/
  all/
    {studentName}/
      {proposalIndex}/
        effect: number (1-5)
        cost: number (1-5)
        practical: number (1-5)
        harmless: number (1-5)
```

### Firebase 보안 규칙

Firebase Console에서 다음 규칙을 설정하세요:

```json
{
  "rules": {
    "proposals": {
      ".read": true,
      ".write": true
    },
    "votes": {
      ".read": true,
      ".write": true
    }
  }
}
```

**주의**: 프로덕션 환경에서는 인증된 사용자만 읽고 쓸 수 있도록 보안 규칙을 강화하는 것을 권장합니다.

## 데이터 파일

- `public/illegal_parking.csv`: 서울시 불법 주정차 민원 데이터
- `public/cctv.csv`: 동작구 CCTV 불법 주정차 구역 데이터

## 기술 스택

- **Vite**: 빌드 도구
- **Chart.js**: 데이터 시각화 (CDN)
- **OpenAI API**: AI 기능
- **Firebase** (선택): 실시간 데이터 공유

## 배포

### Netlify 배포

1. GitHub 저장소에 코드 푸시
2. Netlify에서 저장소 연결
3. 환경변수 설정:
   - `VITE_OPENAI_API_KEY`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## 사용 방법

1. 웹사이트 접속
2. 이름 입력 후 시작하기 클릭
3. 각 단계를 순서대로 진행
4. 데이터를 분석하고 문제의 원인 파악
5. 해결방안 제안 및 작성
6. AI 피드백 받기
7. 다른 학생들의 제안 평가 및 투표
8. 결과 확인 및 대시보드 확인

## 라이선스

이 프로젝트는 교육용으로 제작되었습니다.

