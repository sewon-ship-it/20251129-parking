import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app = null;
let db = null;

try {
  // Firebase 환경 변수가 모두 있는지 확인
  const hasAllConfig = firebaseConfig.apiKey && 
                       firebaseConfig.authDomain && 
                       firebaseConfig.databaseURL &&
                       firebaseConfig.projectId;
  
  if (hasAllConfig) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  } else {
    console.warn('Firebase 환경 변수가 설정되지 않았습니다. Firebase 기능이 비활성화됩니다.');
    console.warn('Netlify에서 환경 변수를 설정해주세요:', {
      apiKey: !!firebaseConfig.apiKey,
      authDomain: !!firebaseConfig.authDomain,
      databaseURL: !!firebaseConfig.databaseURL,
      projectId: !!firebaseConfig.projectId
    });
  }
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
  db = null;
}

export { db };

