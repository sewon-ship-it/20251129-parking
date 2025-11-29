import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA7zgjENmmFBPeqBKUKdiUv6L7D7e6YAjQ",
  authDomain: "parking-1281f.firebaseapp.com",
  databaseURL: "https://parking-1281f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "parking-1281f",
  storageBucket: "parking-1281f.firebasestorage.app",
  messagingSenderId: "461971814300",
  appId: "1:461971814300:web:b1a58cfc8f153fe634ba59"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

