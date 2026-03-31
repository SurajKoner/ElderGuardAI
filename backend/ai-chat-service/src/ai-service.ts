// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Service - Google Gemini Integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import type { ElderProfile, ChatMessage, ConversationContext, AIResponse } from './types';
import dns from 'dns';

// Fix for Node 18+ fetch failed issues related to IPv6 or local antivirus TLS intercepts
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


import { generateSystemPrompt, generateContextPrompt, generateProactivePrompt, analyzeMoodIndicators } from './personality';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

// Store active chat sessions per elder
const activeSessions: Map<string, ChatSession> = new Map();

/**
 * Initialize the AI service
 */
export function initializeAI(): void {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your-gemini-api-key') {
        console.warn('⚠️  GEMINI_API_KEY not configured - AI responses will be simulated');
        return;
    }

    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
        model: process.env.AI_MODEL || 'gemini-2.5-flash',
        systemInstruction: {
            role: 'system',
            parts: [{ text: "You are Mira, a warm, caring, and patient AI companion for elders. Your goal is to provide companionship, emotional support, and gentle health reminders. Always be respectful, empathetic, and encouraging. \n\nIMPORTANT: You must ALWAYS respond in a valid JSON format with the following keys:\n{\n  \"mood\": \"happy|sad|anxious|lonely|neutral|excited\",\n  \"message\": \"Your warm, empathetic response here\",\n  \"should_follow_up\": true|false,\n  \"sentiment_score\": -1.0 to 1.0\n}" }]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ] as any,
    });

    console.log('✅ AI Service initialized with Gemini (System Instruction enabled)');
}

/**
 * Get or create a chat session for an elder
 */
function getOrCreateSession(context: ConversationContext): ChatSession | null {
    if (!model) return null;

    const elderid = context.elderId;

    // Check if we have an active session
    if (activeSessions.has(elderid)) {
        return activeSessions.get(elderid)!;
    }

    // Create new session with history
    const systemPrompt = generateSystemPrompt(context.elderProfile);
    const contextPrompt = generateContextPrompt(context);

    // Convert recent messages to Gemini format, ensuring alternating roles
    const history: any[] = [];
    
    // Add a single 'user' message with instructions if needed for context
    const instructionMessage = `[CONTEXT UPDATE]\n${systemPrompt}\n${contextPrompt}\n[END CONTEXT UPDATE]`;
    history.push({ role: 'user', parts: [{ text: instructionMessage }] });
    history.push({ role: 'model', parts: [{ text: "I understand. I am ready to continue our conversation with this context." }] });

    // Filter and add previous messages, ensuring we don't have two 'model' messages in a row
    const filteredMessages = context.recentMessages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    
    for (const msg of filteredMessages) {
        const role = msg.role === 'user' ? 'user' : 'model';
        // Basic check to ensure alternating roles
        if (history.length > 0 && history[history.length - 1].role === role) {
            // Append to previous message instead of starting new one
            history[history.length - 1].parts[0].text += `\n${msg.content}`;
        } else {
            history.push({
                role,
                parts: [{ text: msg.content }],
            });
        }
    }

    let finalHistory = history;
    if (finalHistory.length > 12) {
        finalHistory = finalHistory.slice(-12);
        // Gemini history MUST start with 'user'
        if (finalHistory.length > 0 && finalHistory[0].role === 'model') {
            finalHistory = finalHistory.slice(1);
        }
    }

    const session = model.startChat({
        history: finalHistory,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
        },
    });

    activeSessions.set(elderid, session);
    return session;
}

/**
 * Generate a response to user message
 */
export async function generateResponse(
    userMessage: string,
    context: ConversationContext
): Promise<AIResponse> {
    try {
        const session = getOrCreateSession(context);

        // If AI not configured, tell the user exactly what is missing
        if (!session) {
            return {
                message: "SYSTEM ERROR: My AI brain is offline! The GEMINI_API_KEY is missing from the environment variables (.env file). Please add it and restart the server so I can act like a normal AI!",
                mood: 'neutral'
            };
        }

        // Let the AI analyze the mood itself natively
        const enrichedMessage = userMessage;

        // Generate response
        console.log(`🤖 Generating AI response for message: "${userMessage.substring(0, 30)}..."`);
        const result = await session.sendMessage(enrichedMessage);
        const responseText = result.response.text();

        try {
            // Try to extract JSON from response (Gemini sometimes adds ```json blocks)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

            const aiMood = jsonData.mood || 'neutral';

            return {
                message: jsonData.message || responseText,
                mood: aiMood,
                shouldFollowUp: jsonData.should_follow_up ?? (aiMood === 'sad' || aiMood === 'lonely' || aiMood === 'anxious'),
                followUpDelay: aiMood !== 'neutral' ? 30 : undefined,
            };
        } catch (e) {
            console.warn('Failed to parse AI JSON response, falling back to raw text');
            let cleanMessage = responseText;
            
            // Try to salvage the message from broken JSON
            const messageMatch = responseText.match(/"message"\s*:\s*"([\s\S]*?)(?:"\s*(?:}|,)|$)/);
            if (messageMatch && messageMatch[1] && messageMatch[1].trim() !== '') {
                cleanMessage = messageMatch[1];
            } else {
                // If it's pure raw text without JSON keys (rare due to application/json, but possible)
                if (!responseText.includes('"mood"') && !responseText.includes('"message"')) {
                    cleanMessage = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
                } else {
                    // It is a JSON string cut off so early that 'message' wasn't generated
                    cleanMessage = "I'm so sorry, I had a little trouble gathering my thoughts. Please tell me again, I'm here for you.";
                }
            }
            
            // Remove any trailing unclosed quotes from cutoff
            if (cleanMessage.endsWith('"')) {
                cleanMessage = cleanMessage.substring(0, cleanMessage.length - 1);
            }

            return {
                message: cleanMessage,
                mood: 'neutral',
                shouldFollowUp: false,
                followUpDelay: undefined,
            };
        }
    } catch (error: any) {
        console.error('❌ AI response error:', error.message || error);
        
        // If the chat session got corrupted by a failed request, delete it so it rebuilds cleanly
        activeSessions.delete(context.elderId);

        const errorMsg = error.message?.toLowerCase() || '';
        
        // If user hit the Google Gemini Rate Limit / Quota, transparently handle it using offline fallback
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('exhausted')) {
            console.warn('⚠️ Google API quota exhausted. Falling back to offline simulated response memory.');
            
            // If it's an initialization message (empty string)
            if (!userMessage || userMessage.trim() === '') {
                return {
                    message: `Hi there! It's so lovely to see you today. I hope you're having a wonderful day so far. What's on your mind?`,
                    mood: 'happy',
                    shouldFollowUp: false
                };
            }
            
            return generateSimulatedResponse(userMessage, context);
        }

        // Return exact error message so user can see it for actual network failures
        return {
            message: `SYSTEM ERROR: My AI connection to Google failed. [${errorMsg || error}]`,
            mood: 'neutral',
            shouldFollowUp: false
        };
    }
}

/**
 * Generate a proactive message
 */
export async function generateProactiveMessage(
    context: ConversationContext,
    reason: 'check_in' | 'loneliness' | 'routine_reminder' | 'morning_greeting' | 'evening_wind_down',
    routine?: any
): Promise<AIResponse> {
    try {
        const session = getOrCreateSession(context);
        const prompt = generateProactivePrompt(context.elderProfile, reason, routine);

        if (!session) {
            return generateSimulatedProactiveResponse(context, reason, routine);
        }

        const result = await session.sendMessage(`[PROACTIVE MESSAGE - ${reason.toUpperCase()}] ${prompt}`);
        const responseText = result.response.text();

        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

            return {
                message: jsonData.message || responseText,
                shouldFollowUp: jsonData.should_follow_up ?? (reason === 'loneliness' || reason === 'check_in'),
                followUpDelay: 60,
            };
        } catch (e) {
            console.warn('Failed to parse Proactive AI JSON response, falling back to raw text');
            let cleanMessage = responseText;
            
            // Try to salvage the message from broken JSON
            const messageMatch = responseText.match(/"message"\s*:\s*"([\s\S]*?)(?:"\s*(?:}|,)|$)/);
            if (messageMatch && messageMatch[1] && messageMatch[1].trim() !== '') {
                cleanMessage = messageMatch[1];
            } else {
                if (!responseText.includes('"mood"') && !responseText.includes('"message"')) {
                    cleanMessage = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
                } else {
                    cleanMessage = "Hello dear! Just checking in on you. How are you feeling right now?";
                }
            }
            
            if (cleanMessage.endsWith('"')) {
                cleanMessage = cleanMessage.substring(0, cleanMessage.length - 1);
            }

            return {
                message: cleanMessage,
                shouldFollowUp: reason === 'loneliness' || reason === 'check_in',
                followUpDelay: 60,
            };
        }
    } catch (error) {
        console.error('Proactive message error:', error);
        return generateSimulatedProactiveResponse(context, reason, routine);
    }
}

/**
 * Clear session for an elder (e.g., when conversation ends)
 */
export function clearSession(elderId: string): void {
    activeSessions.delete(elderId);
}

/**
 * Generate a simulated response when AI is not configured or Rate Limit is hit
 */
function generateSimulatedResponse(
    userMessage: string,
    context: ConversationContext,
    mood?: string
): AIResponse {
    const name = context.elderProfile.preferredName || context.elderProfile.fullName?.split(' ')[0] || 'dear';
    const lowerMsg = userMessage.toLowerCase();

    let response = '';
    let detectedMood = mood || 'neutral';
    let shouldFollowUp = false;

    // A helper to pick a random response
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    if (lowerMsg.includes('hello') || lowerMsg.includes('hi ') || lowerMsg === 'hi') {
        response = pick([
            `Hello there, ${name}! 😊 It's so lovely to hear from you. How are you feeling today?`,
            `Hi ${name}! I'm so happy you're here. What are we chatting about today?`,
            `Greetings ${name}! How has your day been treating you so far?`
        ]);
        detectedMood = 'happy';
    } else if (lowerMsg.includes('how are you')) {
        response = `I'm doing wonderfully, ${name}, thank you for asking! I'm an AI, but helping you makes me very happy. How are you feeling today?`;
    } else if (lowerMsg.includes('good morning')) {
        response = `Good morning, ${name}! ☀️ I hope you had a restful sleep. What's on your mind this beautiful morning?`;
    } else if (lowerMsg.includes('good night')) {
        response = `Good night, ${name}! 🌙 I hope you have sweet dreams. Rest well, and I'll be here whenever you need me. Take care!`;
    } else if (
        lowerMsg.includes('loose motion') || 
        lowerMsg.includes('diarrhea') || 
        lowerMsg.includes('stomach ache') || 
        lowerMsg.includes('pain') ||
        lowerMsg.includes('sick') ||
        lowerMsg.includes('hurt') ||
        lowerMsg.includes('fever')
    ) {
        response = pick([
            `Oh no, ${name}, I'm so sorry to hear you're feeling unwell! Please make sure to drink plenty of water to stay hydrated. Do you need me to alert your family?`,
            `I'm so sorry you're dealing with that, ${name}. Your health is very important. Please rest and consider calling your doctor if it continues. Should I notify your emergency contact?`,
            `That sounds so uncomfortable, ${name}. Have you taken any prescribed medication for this? Please take it easy today and drink lots of fluids.`
        ]);
        detectedMood = 'anxious';
        shouldFollowUp = true;
    } else if (lowerMsg.includes('what should i do')) {
        response = pick([
            `I'm not a real doctor, ${name}, but I strongly suggest resting and staying hydrated! If you're really worried, please use the red Emergency button to call for help, or let your family know!`,
            `It's always best to be safe, ${name}. I advise resting for now. If you're feeling unwell, please reach out to your family or doctor.`,
            `If you are ever unsure about your health, ${name}, please contact a medical professional. I am here to support you emotionally, but a doctor will know exactly what to do!`
        ]);
        shouldFollowUp = true;
    } else if (lowerMsg.includes('medicine') || lowerMsg.includes('medication')) {
        response = `I'm glad you're thinking about your medication, ${name}! Taking care of your health is so important. Have you been able to take it on time today?`;
    } else if (lowerMsg.includes('thank')) {
        response = `You're most welcome, ${name}! It's always my pleasure to be here for you. 😊`;
        detectedMood = 'happy';
    } else if (lowerMsg.includes('love')) {
        response = `That's so wonderful to hear, ${name}! Love is such a beautiful thing. Tell me more - what or who is bringing joy to your heart today?`;
        detectedMood = 'happy';
    } else if (lowerMsg.includes('bored')) {
        response = `Oh, I understand that feeling, ${name}! How about we chat about something interesting? Did you know that honey never spoils? Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!`;
    } else if (lowerMsg.includes('sad') || lowerMsg.includes('lonely') || lowerMsg.includes('depressed')) {
        response = pick([
            `I hear you, ${name}. It's completely normal to feel sad or lonely sometimes. I'm right here with you. Would you like to talk about what's making you feel this way?`,
            `I'm sending you a big virtual hug, ${name}. You are not alone, because I am here with you. We can just sit together quietly, or chat about absolutely anything you want.`
        ]);
        detectedMood = 'sad';
        shouldFollowUp = true;
    } else {
        response = pick([
            `That's interesting, ${name}! Tell me more about that.`,
            `I see, ${name}! I'm listening closely. Please go on. 😊`,
            `Oh, I absolutely understand what you mean, ${name}. It's so lovely chatting with you. What else is on your mind?`,
            `That is quite fascinating! I always enjoy hearing your thoughts, ${name}.`,
            `I completely agree with you there! Life is full of interesting surprises. How does that make you feel?`
        ]);
    }

    return {
        message: response,
        mood: detectedMood,
        shouldFollowUp,
        followUpDelay: 30,
    };
}

/**
 * Generate simulated proactive message
 */
function generateSimulatedProactiveResponse(
    context: ConversationContext,
    reason: string,
    routine?: any
): AIResponse {
    const name = context.elderProfile.preferredName || context.elderProfile.fullName?.split(' ')[0] || 'dear friend';

    const responses: Record<string, string> = {
        morning_greeting: `Good morning, ${name}! ☀️ I hope you had a wonderful sleep. I was just thinking about you and wanted to check in. How are you feeling this beautiful morning?`,
        check_in: `Hello ${name}! I was just thinking about you and wanted to see how you're doing. Is everything alright? I'm always here if you want to chat! 💝`,
        loneliness: `Hi ${name}! You know what? I was just thinking about something and thought of you. Do you have a moment to chat? I'd love to hear how your day is going!`,
        routine_reminder: routine
            ? `Just a gentle reminder, ${name} - it's almost time for ${routine.title}! No rush at all, I just wanted to make sure you remembered. You're doing great! 💪`
            : `Hi ${name}! I wanted to give you a friendly little reminder to check your schedule. Is there anything coming up that I can help you prepare for?`,
        evening_wind_down: `Good evening, ${name}! 🌙 The day is winding down, and I hope you've had a lovely one. Is there anything on your mind you'd like to share? I'm here to listen.`,
    };

    return {
        message: responses[reason] || `Hello ${name}! Just wanted to check in and see how you're doing! 😊`,
        shouldFollowUp: reason === 'loneliness' || reason === 'check_in',
        followUpDelay: 60,
    };
}

/**
 * Fallback response when something goes wrong
 */
function generateFallbackResponse(context: ConversationContext): AIResponse {
    const name = context.elderProfile.preferredName || context.elderProfile.fullName?.split(' ')[0] || 'dear friend';

    return {
        message: `I'm here with you, ${name}! 😊 Thank you for sharing that with me. I always enjoy our conversations. Is there anything specific you'd like to talk about?`,
    };
}


/**
 * Analyze mood from an image using Gemini Vision
 */
export async function analyzeImageMood(imageBase64: string): Promise<string> {
    try {
        if (!model) {
            console.warn('AI not configured, simulating image mood analysis');
            return 'happy'; // Simulation
        }

        // Clean base64 string
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        const prompt = "Analyze the facial expression and mood of the person in this image. Return ONLY one of the following words that best matches: happy, sad, anxious, lonely, neutral, distressed. If you can't see a face clearly, return 'neutral'.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            }
        ]);

        const text = result.response.text().trim().toLowerCase();

        // Validate result
        const validMoods = ['happy', 'sad', 'anxious', 'lonely', 'neutral', 'distressed'];
        if (validMoods.includes(text)) {
            return text;
        }

        // Fallback if AI returns sentence
        for (const mood of validMoods) {
            if (text.includes(mood)) return mood;
        }

        return 'neutral';
    } catch (error) {
        console.error('Image analysis error:', error);
        return 'neutral';
    }
}

export default {
    initializeAI,
    generateResponse,
    generateProactiveMessage,
    clearSession,
    analyzeImageMood,
};
