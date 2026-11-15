import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reaction } from '../types';

interface ReactionsOverlayProps {
  reactions?: Reaction[];
  compact?: boolean;
  onTriggerReaction?: (emoji: string, type: string) => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  left: number;
  senderName: string;
}

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({ reactions = [], compact = false }) => {
  const [floatingList, setFloatingList] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    if (!reactions || reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];
    const newEmoji: FloatingEmoji = {
      id: latest.id || Math.random().toString(),
      emoji: latest.emoji,
      left: compact ? (15 + Math.random() * 65) : (60 + Math.random() * 28),
      senderName: latest.senderName,
    };

    setFloatingList((prev) => [...prev.slice(-10), newEmoji]);

    const timer = setTimeout(() => {
      setFloatingList((prev) => prev.filter((item) => item.id !== newEmoji.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [reactions, compact]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      <AnimatePresence>
        {floatingList.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.6, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: compact ? -130 : -160 }}
            exit={{ opacity: 0, scale: 0.8, y: compact ? -180 : -240 }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${compact ? 'bottom-2' : 'bottom-20'} flex flex-col items-center pointer-events-none`}
            style={{ left: `${item.left}%` }}
          >
            <span className={`${compact ? 'text-2xl' : 'text-2xl sm:text-3xl'} select-none filter drop-shadow-md`}>
              {item.emoji}
            </span>
            {item.senderName && (
              <span className="text-[10px] text-white/80 bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-md mt-1 whitespace-nowrap border border-white/[0.1] font-medium tracking-tight">
                {item.senderName}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const ReactionBar: React.FC<{
  onTriggerReaction: (emoji: string, type: string) => void;
}> = ({ onTriggerReaction }) => {
  const reactionEmojis = [
    { emoji: '❤️', type: 'heart', label: 'Love' },
    { emoji: '🔥', type: 'fire', label: 'Fire' },
    { emoji: '😂', type: 'laugh', label: 'Laugh' },
    { emoji: '🎉', type: 'party', label: 'Party' },
    { emoji: '👏', type: 'clap', label: 'Clap' },
    { emoji: '🍿', type: 'popcorn', label: 'Popcorn' },
  ];

  return (
    <div className="flex items-center gap-1 bg-black/50 hover:bg-black/70 border border-white/[0.08] hover:border-white/[0.14] px-2 py-1 rounded-full backdrop-blur-xl shadow-lg transition-all">
      {reactionEmojis.map((r) => (
        <button
          key={r.type}
          onClick={() => onTriggerReaction(r.emoji, r.type)}
          className="text-base sm:text-lg hover:scale-125 active:scale-95 transition-transform p-1 rounded-full hover:bg-white/[0.08]"
          title={`Send ${r.label}`}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
};
