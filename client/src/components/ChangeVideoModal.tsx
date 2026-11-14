import React, { useState, useEffect } from 'react';
import { X, Play, Link2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ChangeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeVideo: (videoId: string, title: string) => void;
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
      api.getCuratedDemos().then((res) => {
        if (res && res.demos) setDemos(res.demos);
      }).catch(() => {});
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
        setError(err.message || 'Invalid YouTube URL');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [url]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !preview.videoId) return;
    onChangeVideo(preview.videoId, preview.info?.title || 'YouTube Video');
    onClose();
    setUrl('');
    setPreview(null);
  };

  const handleSelectDemo = (demo: any) => {
    onChangeVideo(demo.videoId, demo.title);
    onClose();
    setUrl('');
    setPreview(null);
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

        <h3 className="text-base font-semibold text-white mb-1">Change Playing Video</h3>
        <p className="text-xs text-gray-400 mb-4">
          As the room creator, changing the video immediately switches playback for all connected viewers.
        </p>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Paste New YouTube URL
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500 pr-9"
              />
              <Link2 className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {preview && preview.info && (
            <div className="p-2.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center gap-3">
              <img
                src={preview.info.thumbnailUrl}
                alt="Thumbnail"
                className="w-16 h-10 object-cover rounded bg-dark-950 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{preview.info.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{preview.info.authorName}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!preview || loading}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-medium text-xs shadow-md shadow-brand-500/25 transition-all flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Switch Video Now</span>
          </button>
        </form>

        {demos.length > 0 && (
          <div className="mt-5 pt-4 border-t border-dark-700/60">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Or pick sample video:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demos.slice(0, 4).map((d) => (
                <button
                  key={d.videoId}
                  onClick={() => handleSelectDemo(d)}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-left transition-colors"
                >
                  <img
                    src={d.thumbnail}
                    alt=""
                    className="w-8 h-6 object-cover rounded bg-dark-950 flex-shrink-0"
                  />
                  <span className="text-[10px] text-gray-300 truncate">{d.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
