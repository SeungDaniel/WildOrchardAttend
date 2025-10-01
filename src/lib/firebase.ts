// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// .env 파일에서 환경 변수를 읽어와 Firebase 구성 객체를 만듭니다.
// 이렇게 하면 코드에 민감한 정보를 직접 노출하지 않아 보안이 강화됩니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 모든 필수 환경 변수가 제대로 설정되었는지 확인합니다.
if (!firebaseConfig.projectId) {
  throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in .env or .env.local");
}
if (!firebaseConfig.appId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_APP_ID is not set in .env or .env.local");
}
if (!firebaseConfig.apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set in .env or .env.local");
}


// Firebase 앱을 초기화합니다. 이미 초기화된 앱이 있다면 기존 앱을 사용합니다.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// 다른 파일에서 Firestore 데이터베이스 인스턴스를 사용할 수 있도록 내보냅니다.
export { app, db };
