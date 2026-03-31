import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    console.log("Checking Firestore Users...");
    try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
            console.log("NO USERS IN FIRESTORE.");
        } else {
            console.log(`Found ${snap.size} users.`);
            snap.forEach(doc => {
                const data = doc.data();
                console.log(`User ID: ${doc.id}`);
                console.log(`Name: ${data.fullName}`);
                console.log(`Role: ${data.role}`);
                console.log(`Code: ${data.connectionCode} (Type: ${typeof data.connectionCode})`);
                console.log("-----");
            });
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
