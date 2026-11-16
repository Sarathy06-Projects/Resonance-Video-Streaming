import React, { useState } from 'react';
import { X, Sparkles, Check, ShieldCheck, Zap, Users, Lock, Palette } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  token?: string;
  onSuccess?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  token,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');

    try {
      if (roomId && token) {
        await api.upgradeRoom(roomId, token);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setSuccess(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-6 shadow-2xl relative text-left">
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-medium text-white mb-1">Upgraded to Premium</h3>
            <p className="text-xs text-white/50">
              Your room now supports up to 50 participants with extended duration.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Resonance Premium</h3>
                <p className="text-xs text-white/40">Watch with larger groups and extended features</p>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-4 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-mono font-medium text-white">₹199</span>
                <span className="text-xs text-white/40 ml-1">/ month</span>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Cancel anytime
              </span>
            </div>

            {/* Features List */}
            <div className="space-y-2.5 mb-5 text-xs text-white/70">
              <div className="flex items-center gap-2.5">
                <Users className="w-3.5 h-3.5 text-white/50" />
                <span>Up to 50 participants per room (vs 20 on Free)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Lock className="w-3.5 h-3.5 text-white/50" />
                <span>Private passcode-protected rooms</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Zap className="w-3.5 h-3.5 text-white/50" />
                <span>Up Next Video Queue with auto-advance</span>
              </div>
            </div>

            {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

            {/* Action Button */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm transition-all disabled:opacity-40"
            >
              {loading ? 'Activating...' : 'Activate Premium'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;
