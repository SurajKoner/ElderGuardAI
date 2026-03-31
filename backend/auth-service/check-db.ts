import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the monorepo root
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('Missing Firebase configuration in .env');
  process.exit(1);
}

// Initialize Firebase Admin
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
    console.log("Checking Firestore Users...");
    try {
        const snap = await db.collection('users').get();
        if (snap.empty) {
            console.log("NO USERS IN FIRESTORE.");
        } else {
            console.log(`Found ${snap.size} users.`);
            snap.forEach(doc => {
                const data = doc.data();
                console.log(`User ID: ${doc.id}`);
                console.log(`Email: ${data.email}`);
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

main();
