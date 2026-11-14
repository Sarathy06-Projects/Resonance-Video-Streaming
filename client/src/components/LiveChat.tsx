import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Crown,
  Smile,
  Volume2,
  VolumeX,
  AlertCircle,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface LiveChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  connectionStatus?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'kicked';
  onSendMessage: (text: string) => Promise<boolean | void>;
  onSendReaction: (emoji: string, type: string) => void;
  onRetryMessage?: (msg: ChatMessage) => Promise<boolean | void>;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  messages,
  currentUserId,
  connectionStatus = 'connected',
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

  // Audio notification chime on incoming messages from others
  const playIncomingChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
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

  const quickReactions = ['🔥', '😂', '❤️', '👏', '🎉', '🍿'];

  return (
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-700/70">
      {/* Chat Header */}
      <div className="h-12 border-b border-dark-700/70 px-4 flex items-center justify-between bg-dark-850/50 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">Live Chat</span>
          <span className="text-xs text-gray-400">({messages.length})</span>
          {/* Connection Status indicator */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-dark-700">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] text-gray-400 font-medium capitalize">
              {connectionStatus === 'connected' ? 'Live' : connectionStatus}
            </span>
          </div>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1"
          title={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4">
            <Smile className="w-8 h-8 mb-2 opacity-50 text-brand-400" />
            <p className="text-xs text-gray-300 font-medium">No messages yet.</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Say hello to everyone in the room!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-0.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: msg.senderColor || '#6366f1' }}
                  />
                  <span className="text-[11px] font-medium text-gray-300">
                    {msg.senderName}
                    {isMe && ' (You)'}
                  </span>
                  {msg.senderRole === 'host' && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-medium">
                      <Crown className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500">{formatTimestamp(msg.timestamp)}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words shadow-sm relative ${
                    isMe
                      ? msg.status === 'failed'
                        ? 'bg-rose-950/80 text-rose-200 border border-rose-800 rounded-tr-none'
                        : msg.status === 'sending'
                        ? 'bg-brand-700/70 text-gray-200 rounded-tr-none border border-brand-500/50'
                        : 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-dark-800 text-gray-200 border border-dark-700/80 rounded-tl-none'
                  }`}
                >
                  {msg.text}

                  {/* Delivery Status Indicator for sender */}
                  {isMe && (
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                      {msg.status === 'sending' && (
                        <span className="inline-flex items-center gap-0.5 text-gray-300">
                          <Clock className="w-2.5 h-2.5 animate-spin" /> Sending...
                        </span>
                      )}
                      {msg.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
                          <AlertCircle className="w-3 h-3 text-rose-400" /> Failed to send
                          {onRetryMessage && (
                            <button
                              onClick={() => onRetryMessage(msg)}
                              className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-[9px]"
                              title="Retry sending"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Retry
                            </button>
                          )}
                        </span>
                      )}
                      {(!msg.status || msg.status === 'sent') && (
                        <span className="inline-flex items-center text-brand-200" title="Sent">
                          <CheckCheck className="w-3 h-3 text-brand-200" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Bar */}
      <div className="px-3 py-1.5 border-t border-dark-700/50 bg-dark-850/40 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
          React
        </span>
        <div className="flex items-center gap-1">
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji, 'quick')}
              className="hover:scale-125 transition-transform text-sm p-1 rounded hover:bg-dark-700/60 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-dark-700/70 bg-dark-900">
        <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 focus-within:border-brand-500 transition-colors">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            disabled={connectionStatus === 'disconnected' || connectionStatus === 'kicked'}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
          />
          {inputText.length > 0 && (
            <span
              className={`text-[10px] font-mono ${
                inputText.length > 450 ? 'text-amber-400 font-bold' : 'text-gray-500'
              }`}
            >
              {inputText.length}/500
            </span>
          )}
          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting}
            className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-opacity flex items-center justify-center cursor-pointer"
            title="Send Message"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
