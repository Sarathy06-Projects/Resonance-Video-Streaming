import React, { useState, useRef, useEffect } from 'react';
import { Send, Crown, User, Smile, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage } from '../types';

interface LiveChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string, type: string) => void;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onSendReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickReactions = ['🔥', '😂', '❤️', '👏', '🎉', '🍿'];

  return (
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-700/70">
      {/* Chat Header */}
      <div className="h-12 border-b border-dark-700/70 px-4 flex items-center justify-between bg-dark-850/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">Live Chat</span>
          <span className="text-xs text-gray-400">({messages.length})</span>
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
            <Smile className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[11px] text-gray-600 mt-0.5">Say hello to everyone in the room!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
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
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-dark-800 text-gray-200 border border-dark-700/80 rounded-tl-none'
                  }`}
                >
                  {msg.text}
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
              className="hover:scale-125 transition-transform text-sm p-1 rounded hover:bg-dark-700/60"
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
            maxLength={300}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-opacity"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
