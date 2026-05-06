import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@elder-nest/shared';

// Types
export interface ElderSummary {
    uid: string;
    name: string;
    photoUrl?: string;
    connectionStatus: 'online' | 'offline';
}

export interface ElderStatus {
    mood: 'happy' | 'okay' | 'sad' | 'anxious' | 'lonely' | 'neutral' | string;
    riskScore: number;
    lastActive: string;
    isEmergency: boolean;
    medicineCompliance: number;
    isFaceAuthenticated: boolean;
    faceAuthTimestamp: string | null;
    vitals: {
        stability: string;
    };
    moodHistory: number[]; // e.g. [40, 60, 30] for graph
}

// Hook to get the list of connected elders using real-time Firestore listeners
export const useConnectedElders = () => {
    const [elders, setElders] = useState<ElderSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribeElders: (() => void)[] = [];
        
        const unsubscribeUser = auth.onAuthStateChanged((user) => {
            if (!user) {
                setElders([]);
                setLoading(false);
                return;
            }

            const userRef = doc(db, 'users', user.uid);
            
            const unsubDoc = onSnapshot(userRef, async (userSnap) => {
                try {
                    if (!userSnap.exists()) {
                        setElders([]);
                        setLoading(false);
                        return;
                    }

                    const familyData = userSnap.data();
                    const elderIds: string[] = familyData?.eldersConnected || [];

                    if (elderIds.length === 0) {
                        setElders([]);
                        setLoading(false);
                        return;
                    }

                    // For each elder ID, fetch their live profile
                    const fetchedElders: ElderSummary[] = [];
                    for (const id of elderIds) {
                        const elderSnap = await getDoc(doc(db, 'users', id));
                        if (elderSnap.exists()) {
                            const data = elderSnap.data();
                            fetchedElders.push({
                                uid: id,
                                name: data.fullName || 'Unknown',
                                connectionStatus: data.isOnline ? 'online' : 'offline',
                                photoUrl: data.profilePicture
                            });
                        }
                    }
                    
                    setElders(fetchedElders);
                } catch (err) {
                    console.error('Failed to fetch elders from Firestore:', err);
                    setError('Failed to load family members');
                } finally {
                    setLoading(false);
                }
            });
            
            unsubscribeElders.push(unsubDoc);
        });

        return () => {
            unsubscribeUser();
            unsubscribeElders.forEach(unsub => unsub());
        };
    }, []);

    return { elders, loading, error };
};

// Hook to get real-time status of a specific elder from Firestore
export const useElderStatus = (elderId: string | null) => {
    const [data, setData] = useState<ElderStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(null);

    useEffect(() => {
        if (!elderId) {
            setLoading(false);
            return;
        }

        const elderRef = doc(db, 'users', elderId);
        
        const unsubscribe = onSnapshot(elderRef, async (snap) => {
            if (snap.exists()) {
                const userData = snap.data();
                
                // Fetch dynamic mood history from subcollection
                let moodHistory = [40, 60, 30, 80, 50, 90, 70]; // Default fallback
                try {
                    const moodRef = collection(db, 'users', elderId, 'mood_history');
                    const q = query(moodRef, orderBy('timestamp', 'desc'), limit(7));
                    const moodSnaps = await getDocs(q);
                    if (!moodSnaps.empty) {
                        const historyPoints: number[] = [];
                        moodSnaps.forEach(doc => {
                           // Arbitrary map mood string to percentage for graph
                           const m = doc.data().mood;
                           const pt = m === 'happy' ? 90 : m === 'sad' ? 20 : m === 'anxious' ? 30 : m === 'lonely' ? 20 : 50;
                           historyPoints.unshift(pt); 
                        });
                        // Fill to 7 items if needed
                        while (historyPoints.length < 7) historyPoints.unshift(50);
                        moodHistory = historyPoints.slice(-7);
                    }
                } catch(e) { /* ignore no index error */ }

                setData({
                    mood: userData.currentMood || 'neutral',
                    riskScore: userData.riskScore || 0,
                    medicineCompliance: userData.medicineCompliance !== undefined ? userData.medicineCompliance : 100,
                    vitals: { stability: userData.vitalsStability || 'Stable' },
                    lastActive: userData.lastActive || new Date().toISOString(),
                    isEmergency: userData.isEmergency || false,
                    isFaceAuthenticated: userData.isFaceAuthenticated || false,
                    faceAuthTimestamp: userData.faceAuthTimestamp || null,
                    moodHistory: moodHistory
                });
            } else {
                setData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Firestore onSnapshot error in useElderStatus:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [elderId]);

    const refresh = () => { };

    return { data, loading, error, refresh };
};
