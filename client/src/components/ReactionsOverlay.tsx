import React, { useEffect, useState } from 'react';
import { Reaction } from '../types';

interface ReactionsOverlayProps {
  reactions: Reaction[];
  onTriggerReaction: (emoji: string, type: string) => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  left: number; // percentage 10% - 90%
  senderName: string;
}

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({
  reactions,
  onTriggerReaction,
}) => {
  const [floatingList, setFloatingList] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];
    const newEmoji: FloatingEmoji = {
      id: latest.id || Math.random().toString(),
      emoji: latest.emoji,
      left: 15 + Math.random() * 70, // random position between 15% and 85%
      senderName: latest.senderName,
    };

    setFloatingList((prev) => [...prev.slice(-15), newEmoji]);

    const timer = setTimeout(() => {
      setFloatingList((prev) => prev.filter((item) => item.id !== newEmoji.id));
    }, 2500);

    return () => clearTimeout(timer);
  }, [reactions]);

  const reactionEmojis = [
    { emoji: '❤️', type: 'heart', label: 'Love' },
    { emoji: '🔥', type: 'fire', label: 'Fire' },
    { emoji: '😂', type: 'laugh', label: 'Laugh' },
    { emoji: '🎉', type: 'party', label: 'Party' },
    { emoji: '👏', type: 'clap', label: 'Clap' },
    { emoji: '🤯', type: 'mindblown', label: 'Mindblown' },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {/* Animated Floating Emojis */}
      {floatingList.map((item) => (
        <div
          key={item.id}
          className="absolute bottom-16 animate-float-up flex flex-col items-center pointer-events-none"
          style={{ left: `${item.left}%` }}
        >
          <span className="text-3xl sm:text-4xl filter drop-shadow-lg select-none">
            {item.emoji}
          </span>
          <span className="text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm mt-1 whitespace-nowrap">
            {item.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ReactionBar: React.FC<{
  onTriggerReaction: (emoji: string, type: string) => void;
}> = ({ onTriggerReaction }) => {
  const reactionEmojis = [
    { emoji: '❤️', type: 'heart' },
    { emoji: '🔥', type: 'fire' },
    { emoji: '😂', type: 'laugh' },
    { emoji: '🎉', type: 'party' },
    { emoji: '👏', type: 'clap' },
    { emoji: '🤯', type: 'mindblown' },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 bg-dark-900/90 border border-dark-700/80 px-2 py-1 rounded-full shadow-lg backdrop-blur-md">
      {reactionEmojis.map((r) => (
        <button
          key={r.type}
          onClick={() => onTriggerReaction(r.emoji, r.type)}
          className="text-lg hover:scale-130 active:scale-95 transition-transform p-1 rounded-full hover:bg-dark-700/50"
          title={`Send ${r.type}`}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
};
