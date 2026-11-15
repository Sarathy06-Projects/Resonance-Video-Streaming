import React from 'react';
import { X, Lock, Unlock, Database, Check } from 'lucide-react';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLocked: boolean;
  onToggleLock: (locked: boolean) => void;
  roomId?: string;
  token?: string;
  currentTheme?: string;
  onSelectTheme?: (theme: string) => void;
  onChangeTheme?: (theme: string) => void;
  isHost?: boolean;
  maxParticipants?: number;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  isLocked,
  onToggleLock,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-6 shadow-2xl relative text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-medium text-white mb-4">Room Settings</h3>

        {/* Lock Room Toggle */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-xs font-medium text-white">Private Room</p>
              <p className="text-[11px] text-white/40">
                {isLocked ? 'Locked • Passcode required' : 'Unlocked • Anyone with link can join'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggleLock(!isLocked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isLocked
                ? 'bg-rose-500 text-white'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {isLocked ? 'Locked' : 'Lock Room'}
          </button>
        </div>

        {/* Platform Architecture Info */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 text-[11px] text-white/40">
          <Database className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Realtime room state coordinated with Neon PostgreSQL and WebSockets.</span>
        </div>
      </div>
    </div>
  );
};

export default RoomSettingsModal;
