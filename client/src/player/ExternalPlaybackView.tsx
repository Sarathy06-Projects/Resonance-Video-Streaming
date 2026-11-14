import React, { useState, useEffect } from 'react';
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
  const [displaySeconds, setDisplaySeconds] = useState(authoritativePlayback?.position || 0);

  // Live ticking session timer
  useEffect(() => {
    if (!isPlaying) {
      setDisplaySeconds(authoritativePlayback?.position || 0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const basePos = authoritativePlayback?.position || 0;
      const updated = authoritativePlayback?.updatedAt || now;
      const rate = authoritativePlayback?.playbackRate || 1.0;
      const elapsed = Math.max(0, (now - updated) / 1000) * rate;
      setDisplaySeconds(basePos + elapsed);
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, authoritativePlayback?.position, authoritativePlayback?.updatedAt, authoritativePlayback?.playbackRate]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getHostname = (link: string) => {
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return 'external service';
    }
  };

  const hostSite = getHostname(url);

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
            <span>Embedding Blocked (Frame Restricted / DRM)</span>
          </>
        )}
      </div>

      {/* Main Title & Description */}
      <h3 className="text-lg sm:text-xl font-bold text-white max-w-lg mb-2">
        {title || 'External Protected Stream'}
      </h3>
      <p className="text-xs text-gray-300 max-w-md mb-6 leading-relaxed">
        <strong>{hostSite}</strong> enforces security policies (X-Frame-Options: SAMEORIGIN or CSP frame-ancestors) that prevent in-frame embedding.
        Resonance maintains your room in sync while you watch!
      </p>

      {/* Action Controls: Play/Pause Session stays inside Resonance */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 z-10">
        {isHost ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePlay();
            }}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-brand-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={isPlaying ? 'Pause synchronized session for room' : 'Start synchronized session for room'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white text-white" />
                <span>Pause Watch Session</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                <span>Play / Start Watch Session</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-xs text-gray-300">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isPlaying ? `Host ${hostName} is playing` : `Host ${hostName} is paused`}</span>
          </div>
        )}

        {/* Optional External Launch Button: strictly opens in a new tab without leaving Resonance */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-dark-800/90 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white text-xs font-medium transition-all hover:scale-105"
          title="Opens video source in a separate browser tab. Resonance stays open here."
        >
          <ExternalLink className="w-3.5 h-3.5 text-brand-400" />
          <span>Open on {hostSite} ↗</span>
        </a>
      </div>

      {/* Realtime Session Coordination Bar */}
      <div className="w-full max-w-md bg-dark-850/80 border border-dark-750 rounded-xl p-3.5 flex items-center justify-between text-xs text-gray-300 shadow-md backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="font-medium text-white">
            {isPlaying ? 'Session Active (Synchronized)' : 'Session Paused'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-gray-300 bg-dark-900/80 px-2.5 py-1 rounded-lg border border-dark-700/60">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span>{formatTime(displaySeconds)}</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-3 max-w-sm">
        Room Chat, Audio Calling, and Video Calling remain live simultaneously.
      </p>
    </div>
  );
};
