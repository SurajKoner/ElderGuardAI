import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    User,
    updateProfile
} from 'firebase/auth';
import { auth, db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';

export { auth, db };

import { ElderUser, FamilyUser } from '../../types/user';

// --- Auth Utilities ---

export const mapFirebaseUserToUser = async (firebaseUser: User | null): Promise<ElderUser | FamilyUser | null> => {
    if (!firebaseUser) return null;
    try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            return userDoc.data() as ElderUser | FamilyUser;
        }
    } catch (e) {
        console.error("Failed to fetch user data from Firestore", e);
    }
    return null;
};

// --- Sign Up ---

export const signUpElder = async (data: any) => {
    try {
        const { email, password, fullName, dateOfBirth, emergencyContact } = data;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: fullName });

        // Generate own connection code for others to join (simple random for now)
        const myConnectionCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Calculate age from dateOfBirth
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        const elderData: Omit<ElderUser, 'createdAt' | 'lastActive' | 'uid'> = {
            email,
            fullName,
            age,
            emergencyContact,
            familyMembers: [],
            connectionCode: myConnectionCode,
            profileSetupComplete: false,
            role: 'elder'
        };

        await setDoc(doc(db, 'users', user.uid), {
            ...elderData,
            uid: user.uid,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
        });

        return user;
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
};

export const signUpFamily = async (data: any) => {
    try {
        const { email, password, fullName, phone, relationship, connectionCode } = data;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: fullName });

        let eldersConnected: string[] = [];

        if (connectionCode) {
            const trimCode = connectionCode.toString().trim().toUpperCase();
            // Find elder in Firestore
            try {
                const q = query(collection(db, 'users'), where('connectionCode', '==', trimCode));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const elderDoc = querySnapshot.docs[0];
                    eldersConnected.push(elderDoc.id);
                    
                    // Update Elder's familyMembers
                    await updateDoc(doc(db, 'users', elderDoc.id), {
                        familyMembers: arrayUnion(user.uid)
                    });
                }
            } catch (e) {
                console.error("Failed to query Firestore for connection code", e);
            }
        }

        const familyData: Omit<FamilyUser, 'createdAt' | 'lastLogin' | 'uid'> = {
            email,
            fullName,
            phone: phone || null,
            relationship: relationship || 'family',
            eldersConnected: eldersConnected, 
            role: 'family'
        };

        await setDoc(doc(db, 'users', user.uid), {
            ...familyData,
            uid: user.uid,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
        });

        return user;
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
};

// --- Sign In ---

export const signInWithEmail = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        try {
            await updateDoc(doc(db, 'users', userCredential.user.uid), {
                lastActive: new Date().toISOString()
            });
        } catch (e) {
             console.warn("Could not update lastActive in Firestore", e);
        }

        return userCredential.user;
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
};

export const signInWithGoogle = async (role: 'elder' | 'family') => {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            const baseData = {
                uid: user.uid,
                email: user.email || '',
                fullName: user.displayName || '',
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                role: role
            };

            if (role === 'elder') {
                await setDoc(userDocRef, {
                    ...baseData,
                    age: 0,
                    emergencyContact: '',
                    familyMembers: [],
                    connectionCode: Math.floor(100000 + Math.random() * 900000).toString(),
                    profileSetupComplete: false
                });
            } else {
                await setDoc(userDocRef, {
                    ...baseData,
                    phone: '',
                    relationship: 'other',
                    eldersConnected: []
                });
            }
        } else {
            await updateDoc(userDocRef, {
                lastActive: new Date().toISOString()
            });
        }

        return user;
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
};

const getFriendlyErrorMessage = (error: any): string => {
    console.error('🔥 [FRONTEND_AUTH_ERROR]:', error);
    
    // Check if it's a network error
    if (error?.message?.toLowerCase().includes('failed to fetch')) {
        return "Network Error: Cannot reach Auth Service. Please check if your backend is running. (NetworkError)";
    }

    const errorCode = error?.code || 'unknown';

    switch (errorCode) {
        case 'auth/unauthorized-domain':
            return `Unauthorized Domain: Please add 'localhost' to Authorized Domains in Firebase Console. (${errorCode})`;
        case 'auth/popup-blocked':
            return "Login popup blocked! Please allow popups for this site. (auth/popup-blocked)";
        case 'auth/popup-closed-by-user':
            return "Login cancelled. Please try again. (auth/popup-closed-by-user)";
        case 'auth/operation-not-allowed':
            return "Google Sign-In is NOT enabled in your Firebase Console. (auth/operation-not-allowed)";
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return "Invalid email or password.";
        case 'auth/email-already-in-use':
            return "This email is already registered.";
        case 'auth/invalid-api-key':
            return "Invalid Firebase API Key in .env. (auth/invalid-api-key)";
        case 'permission-denied':
            return "Permission Denied: Firebase Firestore Security Rules are blocking access. Please update your rules in the Firebase Console.";
        default:
            return `An unexpected error occurred: ${errorCode}. Please check the console for details.`;
    }
};

// --- Sign Out ---

export const signOut = async () => {
    localStorage.removeItem('dev_bypass_auth');
    await firebaseSignOut(auth);
};

// --- Password Management ---

export const sendPasswordResetEmail = async (email: string) => {
    await firebaseSendPasswordResetEmail(auth, email);
};

// --- State Listener ---

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
    return firebaseOnAuthStateChanged(auth, callback);
};
