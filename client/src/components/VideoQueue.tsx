import React, { useState } from 'react';
import { ListPlus, Play, Trash2, Plus, Lock } from 'lucide-react';
import { QueueItem } from '../types';
import { api } from '../services/api';

interface VideoQueueProps {
  queue: QueueItem[];
  isHost: boolean;
  onAddToQueue: (videoId: string, title: string, thumbnailUrl: string, provider?: string) => void;
  onRemoveFromQueue: (itemId: string) => void;
  onPlayNext: (targetItemId?: string) => void;
}

export const VideoQueue: React.FC<VideoQueueProps> = ({
  queue,
  isHost,
  onAddToQueue,
  onRemoveFromQueue,
  onPlayNext,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !isHost) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.validateUrl(urlInput.trim());
      if (res.valid && res.videoId) {
        onAddToQueue(
          res.videoId,
          res.info?.title || res.title || 'Queued Video',
          res.info?.thumbnailUrl || res.thumbnailUrl || `https://img.youtube.com/vi/${res.videoId}/hqdefault.jpg`,
          res.provider || res.info?.provider || 'youtube'
        );
        setUrlInput('');
      } else {
        setError(res.error || 'Invalid video link');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid video URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0a0c10] text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0">
        <div>
          <h3 className="text-xs font-medium text-white/90">Up Next</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            {queue.length} {queue.length === 1 ? 'video' : 'videos'} in queue
          </p>
        </div>
        {isHost && queue.length > 0 && (
          <button
            onClick={() => onPlayNext()}
            className="flex items-center gap-1.5 text-xs text-black bg-white hover:bg-white/90 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Play Next</span>
          </button>
        )}
      </div>

      {/* Host Add to Queue Form */}
      {isHost ? (
        <form onSubmit={handleAdd} className="mt-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setError('');
              }}
              placeholder="Paste video link to queue..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="p-2 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-20 transition-all"
              title="Add to queue"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && <p className="text-[10px] text-rose-400 mt-1 px-1">{error}</p>}
        </form>
      ) : (
        <div className="mt-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/40 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 flex-shrink-0 text-white/40" />
          <span>Only the host can add or manage queued videos.</span>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-none">
        {queue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 mb-3">
              <ListPlus className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-white/80">Queue is empty</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-[200px]">
              {isHost
                ? 'Paste video links above to play them continuously in the room.'
                : 'Queued videos will appear here and play automatically.'}
            </p>
          </div>
        ) : (
          queue.map((item, index) => (
            <div
              key={item.id}
              className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] transition-all"
            >
              <span className="text-[10px] font-mono text-white/30 w-4 text-center">
                {index + 1}
              </span>

              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-14 h-9 object-cover rounded-lg bg-black/40 flex-shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/90 truncate">{item.title}</p>
                <p className="text-[10px] text-white/40 mt-0.5">Added by {item.addedBy}</p>
              </div>

              {isHost && (
                <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onPlayNext(item.id)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Play this video now"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={() => onRemoveFromQueue(item.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VideoQueue;
