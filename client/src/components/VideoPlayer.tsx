import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Radio,
  Zap,
  SkipForward,
  Crown,
} from 'lucide-react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { ReactionsOverlay, ReactionBar } from './ReactionsOverlay';
import { Reaction } from '../types';

interface VideoPlayerProps {
  videoId: string;
  isHost: boolean;
  hostName: string;
  authoritativePlayback: {
    status: 'playing' | 'paused' | 'ended';
    position: number;
    updatedAt: number;
    playbackRate: number;
  } | null;
  reactions: Reaction[];
  onTriggerReaction: (emoji: string, type: string) => void;
  onHostPlay: (pos: number) => void;
  onHostPause: (pos: number) => void;
  onHostSeek: (pos: number) => void;
  onHostRate: (rate: number) => void;
  onPlayNextQueue?: () => void;
  hasQueueItem?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  isHost,
  hostName,
  authoritativePlayback,
  reactions,
  onTriggerReaction,
  onHostPlay,
  onHostPause,
  onHostSeek,
  onHostRate,
  onPlayNextQueue,
  hasQueueItem,
}) => {
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isAutoplayBlocked,
    play,
    pause,
    seekTo,
    setRate,
    changeVolume,
    toggleMute,
    unMute,
    syncWithAuthoritative,
  } = useYouTubePlayer({
    videoId,
    isHost,
    onLocalPlay: (pos) => onHostPlay(pos),
    onLocalPause: (pos) => onHostPause(pos),
    onLocalSeek: (pos) => onHostSeek(pos),
    onVideoEnd: () => {
      if (isHost && onPlayNextQueue) {
        onPlayNextQueue();
      }
    },
  });

  // Calculate drift between guest current time and host authoritative state (Section 11.2 & 11.3)
  const [driftSeconds, setDriftSeconds] = useState<number>(0);

  // Periodic active sync & drift monitor for viewers
  useEffect(() => {
    if (!authoritativePlayback || isHost || !isReady) return;

    const interval = setInterval(() => {
      const now = Date.now();
      let expected = authoritativePlayback.position;
      if (authoritativePlayback.status === 'playing') {
        const elapsed = (now - authoritativePlayback.updatedAt) / 1000;
        expected += elapsed * (authoritativePlayback.playbackRate || 1.0);
      }

      const drift = Math.abs(currentTime - expected);
      setDriftSeconds(drift);

      // If host is playing but viewer is not playing, immediately trigger sync
      if (!isPlaying && authoritativePlayback.status === 'playing') {
        syncWithAuthoritative(
          expected,
          authoritativePlayback.status,
          authoritativePlayback.playbackRate
        );
      } else if (drift > 1.0) {
        // Auto drift correction if drift > 1.0s
        syncWithAuthoritative(
          expected,
          authoritativePlayback.status,
          authoritativePlayback.playbackRate
        );
      }
    }, 800);

    return () => clearInterval(interval);
  }, [
    authoritativePlayback,
    currentTime,
    isHost,
    isReady,
    isPlaying,
    syncWithAuthoritative,
  ]);

  // Sync immediately when authoritative state changes, player becomes ready, or video changes
  useEffect(() => {
    if (!authoritativePlayback || isHost || !isReady) return;

    const now = Date.now();
    let expected = authoritativePlayback.position;
    if (authoritativePlayback.status === 'playing') {
      const elapsed = (now - authoritativePlayback.updatedAt) / 1000;
      expected += elapsed * (authoritativePlayback.playbackRate || 1.0);
    }

    syncWithAuthoritative(
      expected,
      authoritativePlayback.status,
      authoritativePlayback.playbackRate
    );
  }, [
    authoritativePlayback?.status,
    authoritativePlayback?.position,
    authoritativePlayback?.updatedAt,
    isReady,
    isHost,
    videoId,
    syncWithAuthoritative,
  ]);

  // Mouse movement hides controls after 3.5 seconds of inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePlay = () => {
    if (!isHost) return;
    if (isPlaying) {
      pause();
      onHostPause(currentTime);
    } else {
      play();
      onHostPlay(currentTime);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seekTo(val);
    if (isHost) {
      onHostSeek(val);
    }
  };

  const skipSeconds = (delta: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + delta));
    seekTo(target);
    if (isHost) {
      onHostSeek(target);
    }
  };

  const toggleFullscreen = () => {
    if (!playerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleManualSync = () => {
    unMute();
    if (!authoritativePlayback) return;
    const now = Date.now();
    let expected = authoritativePlayback.position;
    if (authoritativePlayback.status === 'playing') {
      expected += (now - authoritativePlayback.updatedAt) / 1000;
    }
    syncWithAuthoritative(expected, authoritativePlayback.status, authoritativePlayback.playbackRate);
  };

  return (
    <div
      ref={playerWrapperRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-center items-center group select-none"
    >
      {/* YouTube Player Target */}
      <div className="w-full h-full relative aspect-video flex items-center justify-center">
        <div ref={containerRef} className="w-full h-full" />

        {/* Viewer transparent click layer: clicking anywhere syncs & unmutes playback */}
        {!isHost && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            title="Click to sync and unmute playback"
            onClick={handleManualSync}
          />
        )}
      </div>

      {/* Big Interactive Center Play Button for Host when paused */}
      {isHost && !isPlaying && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePlay();
          }}
          className="absolute inset-0 z-15 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-all cursor-pointer group/centerplay"
          title="Click to Play"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-600/95 group-hover/centerplay:bg-brand-500 text-white flex items-center justify-center shadow-2xl shadow-brand-500/50 transform group-hover/centerplay:scale-110 transition-transform">
            <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-white ml-1.5 text-white" />
          </div>
        </button>
      )}

      {/* Prominent Overlay for Viewer when Host is Playing but Viewer is not yet playing */}
      {!isHost && authoritativePlayback?.status === 'playing' && !isPlaying && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleManualSync();
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 hover:bg-black/50 transition-all cursor-pointer backdrop-blur-[2px] p-6 text-center animate-fade-in"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center mb-3 shadow-2xl shadow-brand-500/50 animate-pulse">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            Host {hostName} started the video!
          </h3>
          <p className="text-xs text-gray-300 max-w-sm mb-4">
            Tap anywhere to sync playback and listen with sound.
          </p>
          <span className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/30">
            Tap to Watch Now
          </span>
        </button>
      )}

      {/* Floating Unmute Banner for Viewer when video is playing muted due to browser policy */}
      {!isHost && isPlaying && (isMuted || isAutoplayBlocked) && (
        <div className="absolute top-4 right-4 z-30 animate-bounce">
          <button
            onClick={(e) => {
              e.stopPropagation();
              unMute();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-xl shadow-brand-500/50 border border-white/20 transition-all hover:scale-105"
          >
            <Volume2 className="w-4 h-4 fill-white animate-pulse" />
            <span>Tap to Unmute Audio</span>
          </button>
        </div>
      )}

      {/* Floating Reactions Overlay */}
      <ReactionsOverlay reactions={reactions} onTriggerReaction={onTriggerReaction} />

      {/* Autoplay Blocked Fallback Modal (Section 11.5) */}
      {isAutoplayBlocked && !isPlaying && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-brand-600/30 border border-brand-500/50 flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Browser Blocked Autoplay</h3>
          <p className="text-sm text-gray-300 max-w-sm mb-5">
            Click below to unmute and sync your playback instantly with the host.
          </p>
          <button
            onClick={handleManualSync}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-lg shadow-brand-500/30 transition-all hover:scale-105"
          >
            <Zap className="w-4 h-4" />
            <span>Tap to Join Playback</span>
          </button>
        </div>
      )}

      {/* Guest Notice: Host Playback Directing Banner (Section 6.3) */}
      {!isHost && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-dark-900/80 backdrop-blur-md border border-dark-700/80 px-3 py-1.5 rounded-full text-xs text-gray-200 shadow-lg">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Host <strong>{hostName}</strong> directing
          </span>
          <span className="text-gray-500">•</span>
          <span className={driftSeconds < 0.5 ? 'text-emerald-400' : 'text-amber-400'}>
            {driftSeconds < 0.5 ? 'Synced' : `${driftSeconds.toFixed(1)}s offset`}
          </span>
          <button
            onClick={handleManualSync}
            className="ml-1 px-2 py-0.5 rounded bg-brand-600/40 hover:bg-brand-600 border border-brand-500/50 text-white text-[11px] transition-colors"
          >
            Sync
          </button>
        </div>
      )}

      {/* Floating Reaction Quick Bar on bottom right */}
      <div className="absolute bottom-20 right-4 z-20">
        <ReactionBar onTriggerReaction={onTriggerReaction} />
      </div>

      {/* Custom Control Overlay (visible on hover or when paused) */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 sm:p-5 z-20 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber / Progress Bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono text-gray-300">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center group/scrub">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}
              disabled={!isHost}
              className={`w-full h-1.5 bg-dark-700 rounded-lg appearance-none accent-brand-500 transition-all ${
                !isHost ? 'opacity-70 pointer-events-none cursor-default' : 'cursor-pointer hover:h-2'
              }`}
            />
          </div>
          <span className="text-[11px] font-mono text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            {isHost ? (
              <button
                onClick={handleTogglePlay}
                className="w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-brand-500/30"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>
            ) : (
              <button
                onClick={handleManualSync}
                className="w-9 h-9 rounded-full bg-dark-800 hover:bg-dark-700 border border-dark-700 flex items-center justify-center text-gray-300 transition-colors"
                title="Tap to sync playback with host"
              >
                {isPlaying ? <Radio className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Play className="w-4 h-4 fill-gray-300 ml-0.5" />}
              </button>
            )}

            {/* Skip 10s */}
            {isHost && (
              <>
                <button
                  onClick={() => skipSeconds(-10)}
                  className="p-1.5 text-gray-300 hover:text-white transition-colors"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => skipSeconds(10)}
                  className="p-1.5 text-gray-300 hover:text-white transition-colors"
                  title="Forward 10s"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Play next in queue if available */}
            {isHost && hasQueueItem && onPlayNextQueue && (
              <button
                onClick={onPlayNextQueue}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-gray-200 border border-dark-700 transition-colors"
                title="Play next video from queue"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Next in Queue</span>
              </button>
            )}

            {/* Volume / Mute */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 text-gray-300 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseInt(e.target.value, 10))}
                className="w-14 sm:w-20 h-1 bg-dark-700 rounded appearance-none accent-brand-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback speed rate: Only Host can change in V1 */}
            {isHost && (
              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setRate(rate);
                  onHostRate(rate);
                }}
                className="bg-dark-800 border border-dark-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1.0}>1.0x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-gray-300 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
