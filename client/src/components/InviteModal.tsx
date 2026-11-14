import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Send, Globe } from 'lucide-react';

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
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `Watch "${roomTitle || 'together'}" with me in a synced watch party on TOGETHER! Join here:`;

  const shareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${roomUrl}`)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${roomUrl}`)}`, '_blank');
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({
        title: 'TOGETHER Watch Party',
        text: shareText,
        url: roomUrl,
      }).catch(() => {});
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Invite Friends</h3>
            <p className="text-xs text-gray-400">Anyone with this link can join and watch in real-time</p>
          </div>
        </div>

        {/* Room Link Box */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Shareable Room Link</label>
          <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-xl p-2 focus-within:border-brand-500">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 bg-transparent text-xs text-gray-200 outline-none font-mono select-all"
            />
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Private room passcode notice if applicable */}
        {isPrivate && passcode && (
          <div className="mb-4 p-3 rounded-xl bg-dark-800/80 border border-dark-700 flex items-center justify-between">
            <span className="text-xs text-gray-400">Room Passcode:</span>
            <span className="font-mono text-sm text-brand-300 font-bold tracking-wider">{passcode}</span>
          </div>
        )}

        {/* Social Share Buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Or share via</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={shareWhatsApp}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[10px]">WhatsApp</span>
            </button>
            <button
              onClick={shareTelegram}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white transition-colors"
            >
              <Send className="w-4 h-4 text-sky-400 mb-1" />
              <span className="text-[10px]">Telegram</span>
            </button>
            <button
              onClick={shareTwitter}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white transition-colors"
            >
              <Globe className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-[10px]">X / Twitter</span>
            </button>
            <button
              onClick={shareNative}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4 text-brand-400 mb-1" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
