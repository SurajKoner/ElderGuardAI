import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@elder-nest/shared';

export const usePresence = () => {
    useEffect(() => {
        let isElder = false;
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                // Check if user is an elder (this can be refined by checking roles/token)
                // For now we check if they are in the 'elder' flow
                const role = localStorage.getItem('user_role') || 'elder';
                if (role === 'elder') {
                    isElder = true;
                    
                    // Set online immediately
                    const userRef = doc(db, 'users', user.uid);
                    updateDoc(userRef, {
                        isOnline: true,
                        lastActive: serverTimestamp()
                    }).catch(e => console.warn('Presence update failed', e));

                    // Setup heartbeat every 30 seconds
                    const interval = setInterval(() => {
                        updateDoc(userRef, {
                            isOnline: true,
                            lastActive: serverTimestamp()
                        }).catch(() => {});
                    }, 30000);

                    return () => {
                        clearInterval(interval);
                        // Try to set offline on cleanup, though this isn't reliable for tab close
                        updateDoc(userRef, { isOnline: false }).catch(() => {});
                    };
                }
            }
        });

        return () => unsubscribe();
    }, []);
};
