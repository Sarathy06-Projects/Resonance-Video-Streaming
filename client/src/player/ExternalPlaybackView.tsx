import React from 'react';
import { ExternalLink, Play, Pause, ShieldAlert, Lock, Radio, Clock, Users } from 'lucide-react';
import { CompatibilityStatus } from './types';

interface ExternalPlaybackViewProps {
  url: string;
  title: string;
  isHost: boolean;
  hostName: string;
  compatibility?: CompatibilityStatus;
  authoritativePlayback: {
    status: 'playing' | 'paused' | 'ended';
    position: number;
    updatedAt: number;
    playbackRate: number;
  } | null;
  onTogglePlay: () => void;
}

export const ExternalPlaybackView: React.FC<ExternalPlaybackViewProps> = ({
  url,
  title,
  isHost,
  hostName,
  compatibility = 'embedding_blocked',
  authoritativePlayback,
  onTogglePlay,
}) => {
  const isPlaying = authoritativePlayback?.status === 'playing';

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getHostname = (link: string) => {
    try {
      return new URL(link).hostname;
    } catch {
      return 'external service';
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Status Pill */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4 backdrop-blur-md">
        {compatibility === 'auth_required' ? (
          <>
            <Lock className="w-3.5 h-3.5" />
            <span>Login Required / Private Content</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Embedding Blocked (DRM / Frame Restricted)</span>
          </>
        )}
      </div>

      {/* Main Title & Description */}
      <h3 className="text-lg sm:text-xl font-bold text-white max-w-lg mb-2">
        {title || 'External Protected Stream'}
      </h3>
      <p className="text-xs text-gray-300 max-w-md mb-6 leading-relaxed">
        {getHostname(url)} protects playback with DRM and blocks third-party iframe embedding.
        Open the stream in an external window to watch legally while Resonance keeps your room in sync!
      </p>

      {/* Primary Action Button */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-brand-500/30 transition-all hover:scale-105"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open on {getHostname(url)}</span>
        </a>

        {isHost && (
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-white text-sm font-medium transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current text-white" />
                <span>Pause Session</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>Start Session</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Realtime Session Coordination Bar */}
      <div className="w-full max-w-md bg-dark-850/80 border border-dark-750 rounded-xl p-3.5 flex items-center justify-between text-xs text-gray-300 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="font-medium text-white">
            {isPlaying ? `Host ${hostName} is playing` : `Host ${hostName} paused`}
          </span>
        </div>

        <div className="flex items-center gap-1 font-mono text-gray-400">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span>Timer: {formatTime(authoritativePlayback?.position || 0)}</span>
        </div>
      </div>
    </div>
  );
};
