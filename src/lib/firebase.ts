
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyC01nU7J9tn9vs_kL5E3d7y4aGmdFVM54U",
    authDomain: "caambacontrol3.firebaseapp.com",
    projectId: "caambacontrol3",
    storageBucket: "caambacontrol3.appspot.com",
    messagingSenderId: "11233123437",
    appId: "1:11233123437:web:edd2f4c4df82467edab364"
};

interface FirebaseInstances {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

// Singleton pattern to ensure single instance
let firebaseInstances: FirebaseInstances | null = null;

export function getFirebase(): FirebaseInstances {
  if (!firebaseInstances) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    firebaseInstances = { app, auth, db };
  }
  return firebaseInstances;
}
