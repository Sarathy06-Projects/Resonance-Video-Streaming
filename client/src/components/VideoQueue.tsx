import React, { useState } from 'react';
import { ListPlus, Play, Trash2, Plus, Sparkles, Lock } from 'lucide-react';
import { QueueItem } from '../types';
import { api } from '../services/api';

interface VideoQueueProps {
  queue: QueueItem[];
  isHost: boolean;
  onAddToQueue: (videoId: string, title: string, thumbnailUrl: string) => void;
  onRemoveFromQueue: (itemId: string) => void;
  onPlayNext: () => void;
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
          res.info.title,
          res.info.thumbnailUrl || `https://img.youtube.com/vi/${res.videoId}/hqdefault.jpg`
        );
        setUrlInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid YouTube URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-700/70 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-dark-700/70">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <ListPlus className="w-4 h-4 text-brand-400" />
          <span>Up Next / Queue</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-dark-800 text-gray-300 border border-dark-700">
            {queue.length}
          </span>
        </h3>
        {isHost && queue.length > 0 && (
          <button
            onClick={onPlayNext}
            className="flex items-center gap-1 text-xs text-brand-300 hover:text-white bg-brand-500/20 hover:bg-brand-500 px-2 py-1 rounded-lg transition-colors border border-brand-500/30"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Play Next</span>
          </button>
        )}
      </div>

      {/* Add to Queue: Only Creator/Host */}
      {isHost ? (
        <form onSubmit={handleAdd} className="mt-3">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setError('');
              }}
              placeholder="Paste YouTube link to queue..."
              className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-all"
              title="Add to queue"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
        </form>
      ) : (
        <div className="mt-3 p-2.5 rounded-xl bg-dark-850/80 border border-dark-750 text-[11px] text-gray-400 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
          <span>Only the room creator can add or change queued videos.</span>
        </div>
      )}

      {/* Queue Items */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {queue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4">
            <Sparkles className="w-8 h-8 mb-2 opacity-40 text-brand-400" />
            <p className="text-xs">No videos in queue.</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {isHost
                ? 'Add YouTube links above so playback flows continuously!'
                : 'The creator has not queued upcoming videos yet.'}
            </p>
          </div>
        ) : (
          queue.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-dark-850/80 border border-dark-750 group hover:border-dark-700 transition-colors"
            >
              <span className="text-xs font-mono text-gray-500 w-4 text-center">
                {index + 1}
              </span>
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-14 h-9 object-cover rounded-md flex-shrink-0 bg-dark-950"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{item.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Added by {item.addedBy}</p>
              </div>
              {isHost && (
                <button
                  onClick={() => onRemoveFromQueue(item.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-dark-700/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
