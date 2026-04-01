// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Companion Chat Component
// Beautiful, accessible chat for elders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, Square, ImagePlus, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  elderId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    mood?: string;
    routineRelated?: boolean;
    isProactive?: boolean;
  };
}

interface AICompanionChatProps {
  elderId?: string;
  elderName?: string;
  companionName?: string;
  serverUrl?: string;
  fontSize?: 'normal' | 'large' | 'extra-large';
  onMoodDetected?: (mood: string) => void;
}

const COMPANION_NAME = 'Mira';

export const AICompanionChat: React.FC<AICompanionChatProps> = ({
  elderId = 'elder-demo',
  elderName = 'dear friend',
  companionName = COMPANION_NAME,
  serverUrl = import.meta.env.VITE_AI_CHAT_URL || 'http://localhost:5001',
  fontSize = 'large',
  onMoodDetected,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Font size multipliers
  const fontSizes = {
    normal: { text: '16px', input: '16px', heading: '20px' },
    large: { text: '20px', input: '20px', heading: '24px' },
    'extra-large': { text: '24px', input: '24px', heading: '28px' },
  };
  const currentFontSize = fontSizes[fontSize];

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect to WebSocket
  useEffect(() => {
    console.log('🔌 Connecting to AI Chat Service...');

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to AI Chat Service');
      setIsConnected(true);
      setIsReconnecting(false);

      // Join as elder
      socket.emit('elder:join', { elderId, profile: { fullName: elderName, preferredName: elderName } });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from AI Chat Service');
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsReconnecting(true);
    });

    // Handle chat history
    socket.on('chat:history', (history: ChatMessage[]) => {
      setMessages(history.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })));
    });

    // Handle new response
    socket.on('chat:response', (message: ChatMessage) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date(message.timestamp),
      }]);
      setIsTyping(false);

      // Notify about mood if detected
      if (message.metadata?.mood && onMoodDetected) {
        onMoodDetected(message.metadata.mood);
      }
    });

    // Handle proactive message
    socket.on('companion:proactive', (message: ChatMessage) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date(message.timestamp),
      }]);

      // Play notification sound for proactive messages
      playNotificationSound();
    });

    // Handle typing indicator
    socket.on('chat:typing', (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    });

    // Handle routine reminders
    socket.on('routine:reminder', (reminder) => {
      console.log('📅 Routine reminder:', reminder);
      // The reminder is already sent as a proactive message
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, elderId, elderName, onMoodDetected]);

  // Play notification sound
  const playNotificationSound = () => {
    // In production, use a gentle chime sound
    // For now, use Web Audio API for a simple tone
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not supported
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Send message
  const handleSendMessage = useCallback(() => {
    const content = inputText.trim();
    if ((!content && !selectedImage) || !socketRef.current) return;

    // Add user message immediately
    const displayContent = selectedImage && !content ? "🖼️ [Image Sent]" : selectedImage ? `🖼️ [Image Attached] ${content}` : content;
    
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      elderId,
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to server
    socketRef.current.emit('chat:message', { 
        content, 
        elderId,
        ...(selectedImage && { imageBase64: selectedImage }) 
    });

    // Clear input
    setInputText('');
    setSelectedImage(null);

    // Show typing indicator
    setIsTyping(true);
  }, [inputText, elderId, selectedImage]);

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice Recording Logic (Native Browser Speech-to-Text)
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInputText(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech recognition is not supported in this browser.");
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Microphone is already started or failed', e);
      }
    } else {
      alert("Voice input is not supported in your browser. Please try Chrome or Edge.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };
  // ------------------------------

  // Quick response buttons
  const quickResponses = [
    { text: '👋 Hello!', message: 'Hello!' },
    { text: '😊 I\'m good', message: 'I\'m feeling good today!' },
    { text: '💊 Medicine', message: 'I took my medicine.' },
    { text: '❓ Help', message: 'I need some help.' },
  ];

  return (
    <div className="companion-chat" style={{ fontSize: currentFontSize.text }}>
      {/* Header */}
      <div className="chat-header">
        <div className="companion-avatar">
          <span className="avatar-emoji">🤗</span>
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
        </div>
        <div className="companion-info">
          <h2 style={{ fontSize: currentFontSize.heading }}>{companionName}</h2>
          <p className="status-text">
            {isConnected
              ? 'Online - Here for you 24/7'
              : isReconnecting
                ? 'Reconnecting...'
                : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-prompt">
            <span className="welcome-emoji">💝</span>
            <p>Hi {elderName}! I'm {companionName}, your caring companion.</p>
            <p>I'm always here to chat, help with reminders, or just keep you company!</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            {message.role === 'assistant' && (
              <div className="message-avatar">🤗</div>
            )}
            <div className={`message-content ${message.role === 'system' ? 'system-message-content bg-rose-100 text-rose-800' : ''}`}>
              <p>{message.content}</p>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
           <div className="message assistant-message typing">
             <div className="message-avatar">🤗</div>
             <div className="message-content">
               <div className="typing-indicator">
                 <span></span>
                 <span></span>
                 <span></span>
               </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Responses */}
      <div className="quick-responses">
        {quickResponses.map((qr, index) => (
          <button
            key={index}
            className="quick-response-btn"
            onClick={() => {
              setInputText(qr.message);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            {qr.text}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="input-container-wrapper" style={{ display: 'flex', flexDirection: 'column', background: 'white' }}>
        {selectedImage && (
          <div className="image-preview-container" style={{ padding: '8px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
               <img src={selectedImage} alt="Selected" style={{ height: '60px', borderRadius: '8px', border: '2px solid #e2e8f0' }} />
               <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <X size={14} />
               </button>
            </div>
          </div>
        )}
        <div className="input-container" style={{ borderTop: selectedImage ? 'none' : '1px solid #e2e8f0' }}>
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
          />
          <button
            className="voice-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected}
            title="Attach Image"
          >
            <ImagePlus size={24} />
          </button>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening..." : `Type a message to ${companionName}...`}
            rows={2}
            style={{ fontSize: currentFontSize.input }}
            disabled={!isConnected || isRecording}
          />
          
          {/* Voice Recording Button */}
          <button
            className={`voice-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
            title={isRecording ? "Stop Recording" : "Use Voice"}
          >
            {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
          </button>

          {/* Send Button */}
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={(!inputText.trim() && !selectedImage) || !isConnected || isRecording}
            aria-label="Send message"
          >
            <span className="send-icon">➤</span>
          </button>
        </div>
      </div>

      <style>{`
        .companion-chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        }

        /* Header */
        .chat-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .companion-avatar {
          position: relative;
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-emoji {
          font-size: 36px;
        }

        .status-dot {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid #6366f1;
        }

        .status-dot.online {
          background: #22c55e;
        }

        .status-dot.offline {
          background: #ef4444;
        }

        .companion-info h2 {
          margin: 0;
          font-weight: 700;
        }

        .status-text {
          margin: 4px 0 0 0;
          opacity: 0.9;
          font-size: 0.85em;
        }

        /* Messages */
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .welcome-prompt {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
        }

        .welcome-emoji {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
        }

        .welcome-prompt p {
          margin: 8px 0;
          line-height: 1.6;
        }

        .message {
          display: flex;
          gap: 12px;
          max-width: 85%;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .user-message {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .assistant-message {
          align-self: flex-start;
        }

        .message-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .message-content {
          background: white;
          padding: 16px 20px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .user-message .message-content {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border-radius: 20px 20px 4px 20px;
        }

        .assistant-message .message-content {
          border-radius: 20px 20px 20px 4px;
        }

        .message-content p {
          margin: 0;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .message-time {
          display: block;
          font-size: 0.75em;
          opacity: 0.7;
          margin-top: 8px;
          text-align: right;
        }

        /* Typing Indicator */
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }

        .typing-indicator span {
          width: 10px;
          height: 10px;
          background: #6366f1;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        /* Quick Responses */
        .quick-responses {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px 16px 20px; /* Extra bottom padding for scrollbar */
          overflow-x: auto;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        /* Hide scrollbar for a cleaner look but still allow scrolling */
        .quick-responses::-webkit-scrollbar {
          height: 6px;
        }
        .quick-responses::-webkit-scrollbar-track {
          background: transparent;
        }
        .quick-responses::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }

        .quick-response-btn {
          flex-shrink: 0;
          padding: 10px 16px;
          background: #f1f5f9;
          border: 2px solid #e2e8f0;
          border-radius: 100px;
          cursor: pointer;
          font-size: 0.9em;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .quick-response-btn:hover {
          background: #e2e8f0;
          border-color: #6366f1;
        }

        /* Input */
        .input-container {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        .input-container textarea {
          flex: 1;
          padding: 16px 20px;
          border: 2px solid #e2e8f0;
          border-radius: 24px;
          resize: none;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .input-container textarea:focus {
          border-color: #6366f1;
        }

        .input-container textarea:disabled {
          background: #f8fafc;
        }

        .send-button {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .voice-button {
          width: 50px;
          height: 50px;
          background: white;
          color: #6366f1;
          border: 2px solid #6366f1;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .voice-button.recording {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
          animation: pulse-red 1.5s infinite;
        }

        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .send-button:hover:not(:disabled), .voice-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        .send-button:disabled, .voice-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-icon {
          color: white;
          font-size: 20px;
        }

        /* Scrollbar */
        .messages-container::-webkit-scrollbar {
          width: 8px;
        }

        .messages-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .messages-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .messages-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default AICompanionChat;
