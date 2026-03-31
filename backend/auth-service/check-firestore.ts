import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('Missing Firebase configuration in .env');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    }),
  });
}

const db = admin.firestore();

async function main() {
    console.log("=== FIRESTORE USERS ===");
    try {
        const snap = await db.collection('users').get();
        if (snap.empty) {
            console.log("No users found in Firestore!");
            process.exit(0);
        }
        console.log(`Analyzing ${snap.size} users...`);
        let count = 0;
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`[User ${++count}] ID: ${doc.id}`);
            console.log(`  Role: ${data.role}`);
            console.log(`  Email: ${data.email}`);
            console.log(`  Name: ${data.fullName}`);
            console.log(`  Code: ${data.connectionCode}`);
        });
        console.log("=== DONE ===");
    } catch (e) {
        console.error("Firestore Error:", e);
    }
    process.exit(0);
}

main();
