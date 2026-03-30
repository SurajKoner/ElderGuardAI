import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    User,
    updateProfile
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    arrayUnion
} from 'firebase/firestore';
import { auth, db } from './config';
export { auth, db };
import { ElderUser, FamilyUser } from '../../types/user';

// --- Auth Utilities ---

export const mapFirebaseUserToUser = async (firebaseUser: User | null): Promise<ElderUser | FamilyUser | null> => {
    if (!firebaseUser) return null;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        return userDoc.data() as ElderUser | FamilyUser;
    }
    return null;
};

// --- Sign Up ---

export const signUpElder = async (data: any) => {
    try {
        const { email, password, fullName, dateOfBirth, emergencyContact, connectionCode: _connectionCode } = data;

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
            connectionCode: myConnectionCode, // Their own code
            profileSetupComplete: false,
            role: 'elder'
        };

        await setDoc(doc(db, 'users', user.uid), {
            ...elderData,
            uid: user.uid,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
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

        // Link Elder Logic
        if (connectionCode) {
            try {
                const usersRef = collection(db, 'users');
                // Query for an elder with this connection code
                const q = query(usersRef, where("connectionCode", "==", connectionCode), where("role", "==", "elder"));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const elderDoc = querySnapshot.docs[0];
                    const elderId = elderDoc.id;
                    eldersConnected.push(elderId);

                    // Update the Elder's doc to include this family member
                    await updateDoc(doc(db, 'users', elderId), {
                        familyMembers: arrayUnion(user.uid)
                    });
                }
            } catch (e) {
                console.error("Failed to link elder during signup", e);
            }
        }

    const familyData: Omit<FamilyUser, 'createdAt' | 'lastLogin' | 'uid'> = {
        email,
        fullName,
        phone: phone || null,  // Firestore does not accept undefined
        relationship: relationship || 'family',
        eldersConnected: eldersConnected, 
        role: 'family'
    };

    await setDoc(doc(db, 'users', user.uid), {
        ...familyData,
        uid: user.uid,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
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

        // Update last login
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        try {
            await updateDoc(userDocRef, {
                lastActive: serverTimestamp() // or lastLogin depending on role, using generic 'lastActive' for simplicity or check role
            });
        } catch (e) {
            // If doc doesn't exist (legacy/error?), ignore or handle
            console.error("Error updating last login", e);
        }

        return userCredential.user;
} catch (error: any) {
    throw new Error(getFriendlyErrorMessage(error));
}
};

// --- Helper: Setup or update Google user document ---

const setupOrUpdateGoogleUser = async (user: User, role: 'elder' | 'family') => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        const baseData = {
            uid: user.uid,
            email: user.email || '',
            fullName: user.displayName || '',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
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
            lastActive: serverTimestamp()
        });
    }
};

// --- Sign In with Google (Redirect-based for reliability) ---

export const signInWithGoogle = async (role: 'elder' | 'family') => {
    try {
        const provider = new GoogleAuthProvider();

        // Store the role in sessionStorage so we can retrieve it after redirect
        sessionStorage.setItem('google_signin_role', role);
        sessionStorage.setItem('google_signin_pending', 'true');

        // Try popup first (faster UX when it works)
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            sessionStorage.removeItem('google_signin_pending');
            await setupOrUpdateGoogleUser(user, role);
            return user;
        } catch (popupError: any) {
            console.warn('⚠️ Popup sign-in failed, falling back to redirect...', popupError?.code);

            // If popup fails due to network/blocked/closed issues, fall back to redirect
            const fallbackCodes = [
                'auth/network-request-failed',
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/internal-error'
            ];

            if (fallbackCodes.includes(popupError?.code)) {
                // Redirect-based sign-in: the page will navigate away and come back
                await signInWithRedirect(auth, provider);
                // This line won't be reached — the browser redirects away
                return null as any;
            }

            // For other errors (invalid API key, operation not allowed, etc.), throw immediately
            throw popupError;
        }
    } catch (error: any) {
        sessionStorage.removeItem('google_signin_pending');
        throw new Error(getFriendlyErrorMessage(error));
    }
};

// --- Process Google Redirect Result (call on app init) ---

export const processGoogleRedirectResult = async (): Promise<User | null> => {
    try {
        const isPending = sessionStorage.getItem('google_signin_pending');
        if (!isPending) return null;

        const result = await getRedirectResult(auth);
        if (result && result.user) {
            const role = (sessionStorage.getItem('google_signin_role') as 'elder' | 'family') || 'elder';
            sessionStorage.removeItem('google_signin_pending');
            sessionStorage.removeItem('google_signin_role');

            await setupOrUpdateGoogleUser(result.user, role);
            console.log('✅ Google redirect sign-in completed for:', result.user.email);
            return result.user;
        }

        // No result but was pending — user may have cancelled or it failed
        sessionStorage.removeItem('google_signin_pending');
        return null;
    } catch (error: any) {
        console.error('🔥 Error processing Google redirect result:', error);
        sessionStorage.removeItem('google_signin_pending');
        sessionStorage.removeItem('google_signin_role');
        return null;
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
        case 'auth/network-request-failed':
            return "Network error: Could not connect to Google. Retrying with redirect... If this persists, check your internet connection and disable any VPN or firewall. (auth/network-request-failed)";
        case 'auth/unauthorized-domain':
            return `Unauthorized Domain: Please add 'localhost' to Authorized Domains in Firebase Console. (${errorCode})`;
        case 'auth/popup-blocked':
            return "Login popup blocked! Retrying with redirect... (auth/popup-blocked)";
        case 'auth/popup-closed-by-user':
            return "Login cancelled. Please try again. (auth/popup-closed-by-user)";
        case 'auth/operation-not-allowed':
            return "Google Sign-In is NOT enabled in your Firebase Console. Go to Authentication > Sign-in method > Google and enable it. (auth/operation-not-allowed)";
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return "Invalid email or password.";
        case 'auth/email-already-in-use':
            return "This email is already registered.";
        case 'auth/invalid-api-key':
            return "Invalid Firebase API Key in .env. (auth/invalid-api-key)";
        default:
            return `An unexpected error occurred: ${errorCode}. Please check the console for details.`;
    }
};

// --- Sign Out ---

export const signOut = async () => {
    localStorage.removeItem('dev_bypass_auth');
    sessionStorage.removeItem('google_signin_pending');
    sessionStorage.removeItem('google_signin_role');
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
