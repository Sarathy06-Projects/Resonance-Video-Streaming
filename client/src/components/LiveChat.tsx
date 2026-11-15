import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Crown,
  Volume2,
  VolumeX,
  AlertCircle,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage, Reaction } from '../types';
import { ReactionsOverlay } from './ReactionsOverlay';

interface LiveChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  connectionStatus?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'kicked';
  reactions?: Reaction[];
  onSendMessage: (text: string) => Promise<boolean | void>;
  onSendReaction: (emoji: string, type: string) => void;
  onRetryMessage?: (msg: ChatMessage) => Promise<boolean | void>;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  messages,
  currentUserId,
  connectionStatus = 'connected',
  reactions = [],
  onSendMessage,
  onSendReaction,
  onRetryMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesCountRef = useRef(messages.length);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Subtle audio chime on incoming messages from others
  const playIncomingChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.senderId !== currentUserId) {
        playIncomingChime();
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, currentUserId, playIncomingChime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSendMessage(text);
      setInputText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickReactions = ['❤️', '🔥', '😂', '🎉', '👏', '🍿'];

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] text-white">
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none relative">
        {/* Floating Reactions Overlay inside Chat */}
        <ReactionsOverlay reactions={reactions} compact />

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 mb-3">
              <span className="text-base">💬</span>
            </div>
            <p className="text-xs font-medium text-white/80">No messages yet</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-[180px]">
              Say hello or react to what everyone is watching.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Name & Timestamp */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-white/40">
                  <span className="font-medium text-white/70">{msg.senderName}</span>
                  {msg.senderRole === 'host' && (
                    <span className="text-amber-400" title="Host">
                      <Crown className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <span>•</span>
                  <span>{formatTimestamp(msg.timestamp)}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] text-xs px-3.5 py-2 leading-relaxed rounded-2xl break-words transition-all ${
                    isMe
                      ? 'bg-white/10 text-white rounded-tr-sm border border-white/[0.08]'
                      : 'bg-white/[0.04] text-white/90 rounded-tl-sm border border-white/[0.05]'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>

                {/* Status indicator for my messages */}
                {isMe && msg.status && (
                  <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-white/35">
                    {msg.status === 'sending' && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5 animate-spin" /> Sending...
                      </span>
                    )}
                    {msg.status === 'sent' && (
                      <span className="flex items-center gap-0.5 text-white/40">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {msg.status === 'failed' && (
                      <button
                        onClick={() => onRetryMessage && onRetryMessage(msg)}
                        className="text-rose-400 hover:underline flex items-center gap-0.5"
                      >
                        <AlertCircle className="w-2.5 h-2.5" /> Retry
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Section */}
      <div className="p-3 border-t border-white/[0.06] bg-[#0c0e14]">
        {/* Quick Reactions Bar */}
        <div className="flex items-center justify-between pb-2.5 px-0.5">
          <div className="flex items-center gap-1.5">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSendReaction(emoji, 'emoji')}
                className="w-7.5 h-7.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95 select-none shadow-sm"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-white/30 hover:text-white/70 p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            title={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Text Input Form */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none pr-10 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting}
            className="absolute right-1.5 p-1.5 rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-20 disabled:hover:bg-white transition-all"
            title="Send message"
          >
            <Send className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LiveChat;
