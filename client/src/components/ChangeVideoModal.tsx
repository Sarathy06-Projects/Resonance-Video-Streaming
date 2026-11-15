import React, { useState, useEffect } from 'react';
import { X, Link2, CheckCircle2, Film } from 'lucide-react';
import { api } from '../services/api';
import { detectProviderQuick, PROVIDER_META, COMPATIBILITY_META } from '../utils/resolver';

interface ChangeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeVideo: (videoId: string, title: string, provider?: string) => void;
}

export const ChangeVideoModal: React.FC<ChangeVideoModalProps> = ({
  isOpen,
  onClose,
  onChangeVideo,
}) => {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demos, setDemos] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api
        .getCuratedDemos()
        .then((res) => {
          if (res && res.demos) setDemos(res.demos);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!url.trim()) {
      setPreview(null);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.validateUrl(url.trim());
        if (res.valid) {
          setPreview(res);
        }
      } catch (err: any) {
        setPreview(null);
        setError(err.message || 'Unsupported or invalid video URL');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [url]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !preview.videoId) return;
    onChangeVideo(
      preview.videoId,
      preview.info?.title || 'Video Stream',
      preview.provider || preview.info?.provider
    );
    onClose();
    setUrl('');
    setPreview(null);
  };

  const handleSelectDemo = (demo: any) => {
    onChangeVideo(demo.videoId, demo.title, demo.provider);
    onClose();
    setUrl('');
    setPreview(null);
  };

  const detected = detectProviderQuick(url);
  const activeMeta = detected ? PROVIDER_META[detected.provider] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-6 shadow-2xl relative text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Film className="w-4 h-4 text-white/70" />
          <h3 className="text-sm font-medium text-white">Change Video</h3>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Paste any supported link: YouTube, direct MP4, HLS (.m3u8), Vimeo, Dailymotion, Twitch, Google Drive.
        </p>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-white/50">
                Video Link
              </label>
              {activeMeta && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activeMeta.badgeBg}`}>
                  {activeMeta.name}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20 pr-9 transition-colors"
              />
              <Link2 className="w-4 h-4 text-white/30 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {loading && (
            <p className="text-xs text-white/50 animate-pulse">Resolving video stream...</p>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          {preview && preview.info && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <img
                  src={preview.info.thumbnailUrl}
                  alt={preview.info.title}
                  className="w-16 h-10 object-cover rounded bg-black/40 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{preview.info.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/40 truncate">{preview.info.authorName}</span>
                    {preview.info.provider && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.06] text-white/70 uppercase">
                        {preview.info.provider}
                      </span>
                    )}
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </div>

              {detected && COMPATIBILITY_META[detected.compatibility] && (
                <div className="pt-2 border-t border-white/[0.06] flex items-start gap-1.5">
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${COMPATIBILITY_META[detected.compatibility].badgeClass}`}
                  >
                    {COMPATIBILITY_META[detected.compatibility].label}
                  </span>
                  <p className="text-[10px] text-white/40 leading-tight">
                    {preview.info.explanation || COMPATIBILITY_META[detected.compatibility].description}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-xs font-medium border border-white/[0.08] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!preview || loading}
              className="flex-1 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-medium transition-all disabled:opacity-30"
            >
              Switch Video
            </button>
          </div>
        </form>

        {demos.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
              Sample Providers:
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto scrollbar-none">
              {demos.map((d) => (
                <button
                  key={d.id || d.videoId}
                  onClick={() => handleSelectDemo(d)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-left transition-colors group"
                >
                  <img
                    src={d.thumbnail}
                    alt={d.title}
                    className="w-10 h-7 object-cover rounded bg-black/40 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white/80 group-hover:text-white truncate">
                      {d.title}
                    </p>
                    <span className="text-[9px] text-white/40 truncate block">
                      {d.category || d.provider}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeVideoModal;
