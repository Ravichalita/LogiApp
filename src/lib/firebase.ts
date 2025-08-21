
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyABRxn8A7wsLOwhl0CaZGN9ZeQiUoiLdDs",
  authDomain: "caambacontrol3.firebaseapp.com",
  projectId: "caambacontrol3",
  storageBucket: "caambacontrol3.appspot.com",
  messagingSenderId: "11233123437",
  appId: "1:11233123437:web:edd2f4c4df82467edab364"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
