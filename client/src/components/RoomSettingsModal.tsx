import React from 'react';
import { X, Lock, Unlock, Palette, Database, Check } from 'lucide-react';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLocked: boolean;
  onToggleLock: (locked: boolean) => void;
  currentTheme: string;
  onChangeTheme: (theme: string) => void;
  isHost: boolean;
  maxParticipants: number;
}

export const THEMES = [
  { id: 'obsidian', name: 'Cinematic Obsidian', bg: 'bg-[#08080a]', border: 'border-zinc-800' },
  { id: 'purple', name: 'Midnight Purple', bg: 'bg-[#0e0720]', border: 'border-purple-900/60' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', bg: 'bg-[#061118]', border: 'border-cyan-900/60' },
  { id: 'emerald', name: 'Emerald Forest', bg: 'bg-[#06160e]', border: 'border-emerald-900/60' },
];

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  isLocked,
  onToggleLock,
  currentTheme,
  onChangeTheme,
  isHost,
  maxParticipants,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-semibold text-white mb-4">Room Settings</h3>

        {/* Lock Room Toggle (Host only) */}
        {isHost && (
          <div className="p-3.5 rounded-xl bg-dark-800/80 border border-dark-700 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLocked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-medium text-white">Room Lock</p>
                <p className="text-[11px] text-gray-400">
                  {isLocked ? 'No new members can enter' : 'Anyone with link can join'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onToggleLock(!isLocked)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isLocked
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-dark-700 hover:bg-dark-600 text-gray-200'
              }`}
            >
              {isLocked ? 'Locked' : 'Lock Room'}
            </button>
          </div>
        )}

        {/* Themes Selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-brand-400" />
            <span>Theme Accent</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => onChangeTheme(theme.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-dark-700 bg-dark-800 text-gray-300 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full ${theme.bg} border border-dark-600 inline-block`} />
                    <span className="truncate">{theme.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Database & Architecture info */}
        <div className="p-3 rounded-xl bg-dark-800/40 border border-dark-700/60 flex items-center gap-2.5 text-[11px] text-gray-400">
          <Database className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Backed by Neon Serverless PostgreSQL with per-room coordinator syncing.</span>
        </div>
      </div>
    </div>
  );
};
