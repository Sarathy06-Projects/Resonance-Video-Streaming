import React, { useState, useEffect } from 'react';
import { X, Play, Link2, CheckCircle2, Film } from 'lucide-react';
import { api } from '../services/api';
import { detectProviderQuick, PROVIDER_META } from '../utils/resolver';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Film className="w-5 h-5 text-brand-400" />
          <h3 className="text-base font-semibold text-white">Change Playing Video</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Supported: YouTube, Direct MP4/WebM, HLS (.m3u8), Vimeo, Dailymotion, DASH (.mpd), Twitch.
        </p>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-300">
                Paste Video Link
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
                placeholder="https://... (YouTube, MP4, HLS, Vimeo, Dailymotion, DASH, Twitch)"
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500 pr-9"
              />
              <Link2 className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {loading && (
            <p className="text-xs text-brand-400 animate-pulse">Resolving video stream...</p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {preview && preview.info && (
            <div className="p-2.5 rounded-xl bg-dark-850 border border-dark-700 flex items-center gap-3">
              <img
                src={preview.info.thumbnailUrl}
                alt={preview.info.title}
                className="w-16 h-10 object-cover rounded bg-dark-950 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{preview.info.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 truncate">{preview.info.authorName}</span>
                  {preview.info.provider && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 uppercase">
                      {preview.info.provider}
                    </span>
                  )}
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-gray-300 text-xs font-medium border border-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!preview || loading}
              className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-all shadow-md shadow-brand-500/20 disabled:opacity-40"
            >
              Switch Video
            </button>
          </div>
        </form>

        {demos.length > 0 && (
          <div className="mt-5 pt-4 border-t border-dark-800">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Curated Provider Samples:
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {demos.map((d) => (
                <button
                  key={d.id || d.videoId}
                  onClick={() => handleSelectDemo(d)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700/80 text-left transition-colors group"
                >
                  <img
                    src={d.thumbnail}
                    alt={d.title}
                    className="w-10 h-7 object-cover rounded bg-dark-950 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-200 group-hover:text-white truncate">
                      {d.title}
                    </p>
                    <span className="text-[9px] text-brand-400 truncate block">
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
