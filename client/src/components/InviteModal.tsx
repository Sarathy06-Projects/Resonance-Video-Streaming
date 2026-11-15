import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Send, Globe } from 'lucide-react';
import { trackEvent } from '../services/analytics';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle?: string;
  isPrivate?: boolean;
  passcode?: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  isPrivate,
  passcode,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomUrl = `${window.location.origin}/room/${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    trackEvent('invite_link_copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `Watch "${roomTitle || 'together'}" with me in a synced watch party on Resonance! Join here:`;

  const shareWhatsApp = () => {
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${roomUrl}`)}`,
      '_blank'
    );
  };

  const shareTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent(
        shareText
      )}`,
      '_blank'
    );
  };

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${roomUrl}`)}`,
      '_blank'
    );
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Resonance Watch Party',
          text: shareText,
          url: roomUrl,
        })
        .catch(() => {});
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-6 shadow-2xl relative text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/80">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Invite Friends</h3>
            <p className="text-xs text-white/40">Anyone with this link can join instantly</p>
          </div>
        </div>

        {/* Room Link Box */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            Shareable Room Link
          </label>
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl p-2 focus-within:border-white/20 transition-colors">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 bg-transparent text-xs text-white/90 outline-none font-mono select-all px-1"
            />
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Private room passcode notice */}
        {isPrivate && passcode && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-white/50">Room Passcode</span>
            <span className="font-mono text-xs text-white font-semibold tracking-wider">
              {passcode}
            </span>
          </div>
        )}

        {/* Social Share Buttons */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-2">Share directly</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={shareWhatsApp}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/80 hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[10px]">WhatsApp</span>
            </button>
            <button
              onClick={shareTelegram}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/80 hover:text-white transition-colors"
            >
              <Send className="w-4 h-4 text-sky-400 mb-1" />
              <span className="text-[10px]">Telegram</span>
            </button>
            <button
              onClick={shareTwitter}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/80 hover:text-white transition-colors"
            >
              <Globe className="w-4 h-4 text-white/80 mb-1" />
              <span className="text-[10px]">X</span>
            </button>
            <button
              onClick={shareNative}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/80 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4 text-white/60 mb-1" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
