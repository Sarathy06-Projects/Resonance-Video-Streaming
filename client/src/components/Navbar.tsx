import React from 'react';
import { Play, Sparkles, Shield, Users, Radio } from 'lucide-react';

interface NavbarProps {
  onOpenNewRoom?: () => void;
  onOpenPricing?: () => void;
  currentRoomId?: string;
  isHost?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewRoom,
  onOpenPricing,
  currentRoomId,
  isHost,
}) => {
  return (
    <header className="h-16 border-b border-dark-700/60 bg-dark-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-wider text-white">TOGETHER</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block -mt-0.5">
              Synced Watch-Parties • Neon DB
            </p>
          </div>
        </a>
      </div>

      {/* Active Room Badge if inside watch room */}
      {currentRoomId && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800 border border-dark-700 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-gray-300">Room:</span>
          <span className="font-mono text-white font-medium">{currentRoomId}</span>
          {isHost && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-500/30">
              Host Directing 👑
            </span>
          )}
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenPricing && (
          <button
            onClick={onOpenPricing}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>₹199 Premium</span>
          </button>
        )}

        {onOpenNewRoom && (
          <button
            onClick={onOpenNewRoom}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 px-3.5 py-1.5 rounded-lg shadow-sm shadow-brand-500/30 transition-all hover:scale-[1.02]"
          >
            <span>+ Create Room</span>
          </button>
        )}
      </div>
    </header>
  );
};
