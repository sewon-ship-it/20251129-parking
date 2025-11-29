# Firebase 연동 가이드

## Firebase 설정 방법

### 1. Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 새 프로젝트 생성
3. 프로젝트 이름: "동작구-미래시장-캠프" (원하는 이름으로 변경 가능)

### 2. Firestore Database 설정
1. Firebase Console에서 "Firestore Database" 메뉴 선택
2. "데이터베이스 만들기" 클릭
3. 프로덕션 모드 또는 테스트 모드 선택 (테스트 모드 권장)
4. 위치 선택 (asia-northeast3 권장 - 서울)

### 3. Firebase SDK 설치
```bash
npm install firebase
```

### 4. Firebase 설정 파일 생성
`src/firebase.js` 파일을 생성하고 아래 코드를 입력:

```javascript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Firebase 설정 정보 (Firebase Console > 프로젝트 설정 > 일반 > 내 앱에서 확인)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}

// Firebase 초기화
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

### 5. 환경변수 설정
`.env` 파일에 Firebase 설정 추가:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

`src/firebase.js`를 환경변수를 사용하도록 수정:
```javascript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

### 6. main.js에 Firebase 연동 코드 추가

`src/main.js` 파일 상단에 import 추가:
```javascript
import { db } from './firebase.js'
import { collection, addDoc, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore'
```

#### 5단계: 제안 저장 (combineProposal 함수 수정)
```javascript
// localStorage 대신 Firebase에 저장
async function saveProposalToFirebase(proposal) {
  try {
    await addDoc(collection(db, 'proposals'), {
      name: proposal.name,
      problem: proposal.problem,
      solution: proposal.solution,
      reason: proposal.reason,
      combinedText: proposal.combinedText,
      text: proposal.combinedText,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('제안 저장 실패:', error)
    throw error
  }
}
```

#### 5단계: 모든 제안 가져오기 (renderStage5 함수 수정)
```javascript
async function loadProposalsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, 'proposals'))
    const proposals = []
    querySnapshot.forEach((doc) => {
      proposals.push({ id: doc.id, ...doc.data() })
    })
    return proposals
  } catch (error) {
    console.error('제안 불러오기 실패:', error)
    return []
  }
}
```

#### 5단계: 투표 저장 (submitVotes 함수 수정)
```javascript
async function saveVotesToFirebase(votes) {
  try {
    const votesRef = doc(db, 'votes', 'current')
    await setDoc(votesRef, {
      votes: votes,
      updatedAt: new Date()
    }, { merge: true })
  } catch (error) {
    console.error('투표 저장 실패:', error)
    throw error
  }
}

async function loadVotesFromFirebase() {
  try {
    const votesRef = doc(db, 'votes', 'current')
    const docSnap = await getDoc(votesRef)
    if (docSnap.exists()) {
      return docSnap.data().votes || {}
    }
    return {}
  } catch (error) {
    console.error('투표 불러오기 실패:', error)
    return {}
  }
}
```

### 7. Firestore 보안 규칙 설정
Firebase Console > Firestore Database > 규칙에서:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // proposals 컬렉션: 읽기/쓰기 모두 허용 (실제 배포 시 인증 추가 권장)
    match /proposals/{proposalId} {
      allow read, write: if true;
    }
    
    // votes 컬렉션: 읽기/쓰기 모두 허용
    match /votes/{voteId} {
      allow read, write: if true;
    }
  }
}
```

**주의:** 프로덕션 환경에서는 인증된 사용자만 읽고 쓸 수 있도록 보안 규칙을 강화해야 합니다.

### 8. Netlify 배포 시 환경변수 설정
1. Netlify 대시보드 > Site settings > Environment variables
2. 다음 변수들 추가:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_OPENAI_API_KEY` (기존)

## 데이터 구조

### proposals 컬렉션
```
proposals/
  {documentId}/
    name: string (학생 이름)
    problem: string (문제 상황)
    solution: string (해결방안)
    reason: string (이유)
    combinedText: string (연결된 공약문)
    text: string (전체 텍스트)
    timestamp: timestamp (작성 시간)
```

### votes 컬렉션
```
votes/
  current/
    votes: {
      "0": {
        effect: number (1-5),
        cost: number (1-5),
        practical: number (1-5),
        harmless: number (1-5)
      },
      "1": { ... },
      ...
    }
    updatedAt: timestamp
```

## 참고사항

- 현재 코드는 localStorage를 사용하도록 되어 있습니다. Firebase를 사용하려면 위의 함수들을 적용하세요.
- 실시간 업데이트를 원한다면 `onSnapshot`을 사용할 수 있습니다.
- 실제 배포 시 보안 규칙을 더 엄격하게 설정하는 것을 권장합니다.

