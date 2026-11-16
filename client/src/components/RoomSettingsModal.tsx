import React, { useState } from 'react';
import { X, Lock, Unlock, Database, Film, KeyRound, AlertCircle, Check } from 'lucide-react';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLocked: boolean;
  hasPasscode?: boolean;
  onToggleLock: (locked: boolean, passcode?: string) => Promise<void> | void;
  onOpenChangeVideo?: () => void;
  isHost?: boolean;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  isLocked,
  onToggleLock,
  onOpenChangeVideo,
  isHost = true,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLockWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = passwordInput.trim();
    if (!clean) {
      setError('Please enter a password to lock the room.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onToggleLock(true, clean);
      setPasswordInput('');
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to lock room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onToggleLock(false);
      setPasswordInput('');
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-2xl relative text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span>Room Settings</span>
        </h3>

        {/* Change Video Action (Available to Host) */}
        {isHost && onOpenChangeVideo && (
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Video Source</p>
                <p className="text-[11px] text-white/40">Switch YouTube, MP4, HLS or stream</p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenChangeVideo();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] text-white transition-colors cursor-pointer"
            >
              Change Video
            </button>
          </div>
        )}

        {/* Lock Room with Password Section */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-medium text-white">Private Room</p>
                <p className="text-[11px] text-white/40">
                  {isLocked
                    ? 'Locked • Password required for future joiners'
                    : 'Unlocked • Anyone with link can join'}
                </p>
              </div>
            </div>

            {isLocked && (
              <button
                onClick={handleUnlock}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                Unlock Room
              </button>
            )}
          </div>

          {/* If Unlocked: Ask for password to lock */}
          {!isLocked ? (
            <form onSubmit={handleLockWithPassword} className="space-y-2.5 pt-2 border-t border-white/[0.06]">
              <label className="block text-[11px] font-medium text-white/60 flex items-center gap-1.5">
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>Set Room Password to Lock</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter password to lock..."
                  maxLength={50}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordInput.trim()}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white text-black hover:bg-white/90 disabled:opacity-30 transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  {isSubmitting ? 'Locking...' : 'Lock Room'}
                </button>
              </div>
              {error && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </form>
          ) : (
            /* If Locked: Allow updating password */
            <form onSubmit={handleLockWithPassword} className="space-y-2 pt-2 border-t border-white/[0.06]">
              <label className="block text-[11px] font-medium text-white/50 flex items-center gap-1.5">
                <KeyRound className="w-3 h-3 text-white/40" />
                <span>Update Room Password</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter new password..."
                  maxLength={50}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordInput.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] text-white disabled:opacity-30 transition-all cursor-pointer shrink-0"
                >
                  Update
                </button>
              </div>
              {isSuccess && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 pt-0.5">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>Room password saved successfully</span>
                </p>
              )}
              {error && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </form>
          )}
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
