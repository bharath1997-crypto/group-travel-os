import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, signInWithCustomToken } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export type FirebaseReady = {
  ok: boolean;
  app: FirebaseApp | null;
  db: Database | null;
};

export function initFirebase(): FirebaseReady {
  if (typeof window === "undefined")
    return { ok: false, app: null, db: null };
  if (!firebaseConfig.databaseURL || !firebaseConfig.apiKey)
    return { ok: false, app: null, db: null };
  try {
    const app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
    return { ok: true, app, db: getDatabase(app) };
  } catch {
    return { ok: false, app: null, db: null };
  }
}

export async function authenticateFirebase(token: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const apps = getApps();
    if (apps.length === 0) return false;
    const app = apps[0]!;
    const auth = getAuth(app);
    await signInWithCustomToken(auth, token);
    return true;
  } catch (error) {
    console.error("Firebase custom token authentication failed:", error);
    return false;
  }
}

