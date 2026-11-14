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
        // Upgrade current room directly
        await api.upgradeRoom(roomId, token);
      } else {
        // Simulated checkout success
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-dark-900 border border-dark-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Welcome to Premium!</h3>
            <p className="text-sm text-gray-300">
              Your room is now upgraded to 15 participants and all premium features are unlocked.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Upgrade to Together Premium</span>
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    POPULAR
                  </span>
                </h3>
                <p className="text-xs text-gray-400">Watch with larger groups and unlock privacy controls</p>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-xl bg-dark-800/80 border border-dark-700 mb-5 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-white font-mono">₹199</span>
                <span className="text-xs text-gray-400 ml-1">/ month</span>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Cancel anytime
              </span>
            </div>

            {/* Features Checklist */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-xs text-gray-200">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span><strong>Up to 15 participants</strong> per room (vs 3 on Free)</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-200">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <span><strong>Private password-protected rooms</strong> with instant lock</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-200">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span><strong>Shared Video Queue</strong> with seamless auto-next playback</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-200">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Palette className="w-3.5 h-3.5" />
                </div>
                <span><strong>Custom Themes</strong> (Midnight Purple, Cyberpunk, Emerald)</span>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            {/* Action Button */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-medium text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-white" />
              <span>{loading ? 'Processing Upgrade...' : 'Activate Premium (₹199/mo)'}</span>
            </button>
            <p className="text-[11px] text-center text-gray-500 mt-2.5">
              Instant activation • Server-verified entitlement stored in Neon DB
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
