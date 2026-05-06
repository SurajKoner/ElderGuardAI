// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Companion Chat Page
// Full-screen chat experience for elders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import React, { useState, useEffect } from 'react';
import AICompanionChat from '../components/chat/AICompanionChat';
import { auth } from '@elder-nest/shared';
import { ElderSidebar } from '../layout/ElderSidebar';
import { motion } from 'framer-motion';

const ChatPage: React.FC = () => {
    const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('large');
    const [detectedMood, setDetectedMood] = useState<string | null>(null);
    const [elderName, setElderName] = useState<string>('Friend');
    const [elderId, setElderId] = useState<string>('elder-demo');

    useEffect(() => {
        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (user) {
                setElderId(user.uid);
                try {
                    const userDataStr = localStorage.getItem(`users_${user.uid}`);
                    if (userDataStr) {
                        const userData = JSON.parse(userDataStr);
                        if (userData && userData.fullName) {
                            setElderName(userData.fullName.split(' ')[0]);
                        }
                    } else if (user.displayName) {
                        setElderName(user.displayName.split(' ')[0]);
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
        };
        fetchUserData();
    }, []);

    const handleMoodDetected = (mood: string) => {
        setDetectedMood(mood);
        console.log('Mood detected:', mood);
    };

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <ElderSidebar />

            <main className="flex-1 flex flex-col lg:ml-72 relative min-h-screen">
                {/* Top Controls */}
                <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-indigo-100 dark:border-slate-800 shadow-sm px-6 py-4">
                    <div className="flex justify-between items-center max-w-5xl mx-auto">
                        <div className="flex items-center gap-4">
                            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs hidden sm:block">Text Size:</span>
                            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button
                                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${fontSize === 'normal' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'}`}
                                    onClick={() => setFontSize('normal')}
                                >
                                    A
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${fontSize === 'large' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'}`}
                                    onClick={() => setFontSize('large')}
                                >
                                    A+
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${fontSize === 'extra-large' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'}`}
                                    onClick={() => setFontSize('extra-large')}
                                >
                                    A++
                                </button>
                            </div>
                        </div>

                        {detectedMood && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 ${
                                    detectedMood === 'happy' ? 'bg-emerald-100 text-emerald-700' : 
                                    detectedMood === 'sad' ? 'bg-blue-100 text-blue-700' : 
                                    'bg-indigo-100 text-indigo-700'
                                }`}
                            >
                                {detectedMood === 'happy' && '😊 Feeling good!'}
                                {detectedMood === 'sad' && '💙 We\'re here for you'}
                                {detectedMood === 'lonely' && '🤗 You\'re not alone'}
                                {detectedMood === 'anxious' && '💆 Take deep breaths'}
                                {detectedMood === 'neutral' && '😌 Doing okay'}
                            </motion.div>
                        )}
                    </div>
                </header>

                {/* Chat Container */}
                <div className="flex-1 p-4 md:p-8 flex flex-col max-w-5xl mx-auto w-full overflow-hidden">
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-500">
                        <AICompanionChat
                            key={elderId}
                            elderId={elderId}
                            elderName={elderName}
                            companionName="Mira"
                            fontSize={fontSize}
                            onMoodDetected={handleMoodDetected}
                        />
                    </div>
                </div>

                {/* Emergency Button */}
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="fixed bottom-8 right-8 z-50 px-8 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-full font-black text-xl shadow-2xl shadow-rose-200 dark:shadow-none flex items-center gap-3"
                    aria-label="Emergency - Call for help"
                >
                    🆘 Need Help
                </motion.button>
            </main>
        </div>
    );
};

export default ChatPage;
