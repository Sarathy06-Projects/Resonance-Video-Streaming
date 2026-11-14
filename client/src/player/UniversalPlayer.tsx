import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  Film,
  Tv,
} from 'lucide-react';
import { UniversalPlayerProps, PlayerAdapter, PlaybackCapabilities, CompatibilityStatus } from './types';
import { detectProviderQuick, PROVIDER_META, VideoProviderType } from '../utils/resolver';
import { ReactionsOverlay, ReactionBar } from '../components/ReactionsOverlay';
import { YouTubeAdapter } from './YouTubeAdapter';
import { Html5Adapter } from './Html5Adapter';
import { VimeoAdapter } from './VimeoAdapter';
import { DailymotionAdapter } from './DailymotionAdapter';
import { TwitchAdapter } from './TwitchAdapter';
import { GenericEmbedAdapter } from './GenericEmbedAdapter';
import { ExternalPlaybackView } from './ExternalPlaybackView';
import { COMPATIBILITY_META } from '../utils/resolver';

export const UniversalPlayer: React.FC<UniversalPlayerProps> = ({
  videoId,
  provider: propProvider,
  videoUrl,
  compatibility: propCompatibility,
  playbackMode: propPlaybackMode,
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
  const adapterRef = useRef<PlayerAdapter | null>(null);

  // Determine active provider & compatibility
  const detected = useMemo(() => {
    if (propProvider) {
      const q = detectProviderQuick(videoUrl || videoId);
      return {
        provider: propProvider,
        videoId,
        compatibility: propCompatibility || q?.compatibility || 'fully_syncable',
        playbackMode: propPlaybackMode || q?.playbackMode || (propProvider === 'external' ? 'external' : 'player'),
      };
    }
    const detectedInfo = detectProviderQuick(videoUrl || videoId);
    if (detectedInfo) return detectedInfo;
    return {
      provider: 'youtube' as VideoProviderType,
      videoId,
      compatibility: 'fully_syncable' as CompatibilityStatus,
      playbackMode: 'player' as const,
    };
  }, [propProvider, propCompatibility, propPlaybackMode, videoId, videoUrl]);

  const activeProvider = detected.provider;
  const activeVideoId = detected.videoId;
  const activeCompatibility = detected.compatibility;
  const activePlaybackMode = detected.playbackMode;
  const activeMediaUrl =
    videoUrl ||
    (activeProvider === 'direct' ||
    activeProvider === 'hls' ||
    activeProvider === 'dash' ||
    activeProvider === 'generic_embed'
      ? activeVideoId
      : '');

  // UI state
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [driftSeconds, setDriftSeconds] = useState(0);

  // Sync guards & debouncing
  const isRemoteActionRef = useRef(false);
  const lastSeekTimestampRef = useRef(0);
  const currentTimeRef = useRef(0);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const markRemoteAction = useCallback(() => {
    isRemoteActionRef.current = true;
    setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 1200);
  }, []);

  // Capabilities
  const capabilities = useMemo<PlaybackCapabilities>(() => {
    if (activePlaybackMode === 'external') {
      return { canSeek: false, canPause: true, canSyncRate: false, isLive: false };
    }
    if (adapterRef.current) return adapterRef.current.getCapabilities();
    if (activeProvider === 'twitch' && !/^\d+$/.test(activeVideoId)) {
      return { canSeek: false, canPause: true, canSyncRate: false, isLive: true };
    }
    return { canSeek: true, canPause: true, canSyncRate: activeProvider === 'youtube' || activeProvider === 'direct' || activeProvider === 'vimeo', isLive: false };
  }, [activeProvider, activeVideoId, activePlaybackMode, isReady]);

  // Adapter Callbacks
  const callbacks = useMemo(
    () => ({
      onReady: () => {
        setIsReady(true);
        if (adapterRef.current) {
          setDuration(adapterRef.current.getDuration());
          adapterRef.current.setVolume(volume);
        }
      },
      onPlay: (pos: number) => {
        setIsPlaying(true);
        setIsBuffering(false);
        if (isHost && !isRemoteActionRef.current) {
          onHostPlay(pos);
        }
      },
      onPause: (pos: number) => {
        setIsPlaying(false);
        setIsBuffering(false);
        if (isHost && !isRemoteActionRef.current) {
          onHostPause(pos);
        }
      },
      onSeek: (pos: number) => {
        if (isHost && !isRemoteActionRef.current) {
          onHostSeek(pos);
        }
      },
      onEnded: () => {
        setIsPlaying(false);
        if (isHost && onPlayNextQueue) {
          onPlayNextQueue();
        }
      },
      onTimeUpdate: (cur: number, dur: number) => {
        setCurrentTime(cur);
        if (dur > 0) setDuration(dur);
      },
      onBuffering: (buffering: boolean) => {
        setIsBuffering(buffering);
      },
      onError: (err: string) => {
        console.warn(`[Player Error ${activeProvider}]`, err);
      },
    }),
    [isHost, onHostPlay, onHostPause, onHostSeek, onPlayNextQueue, volume, activeProvider]
  );

  // Synchronize viewer with host authoritative state
  const syncWithAuthoritative = useCallback(
    (expectedTime: number, targetStatus: string, rate: number = 1.0) => {
      if (isHost || !adapterRef.current || !isReady) return;

      const caps = adapterRef.current.getCapabilities();
      const current = adapterRef.current.getCurrentTime();
      const drift = Math.abs(current - expectedTime);
      setDriftSeconds(drift);

      // 1. Play / Pause State Alignment
      if (targetStatus === 'playing') {
        if (!isPlaying) {
          markRemoteAction();
          adapterRef.current.play();
        }
      } else if (targetStatus === 'paused') {
        if (isPlaying) {
          markRemoteAction();
          adapterRef.current.pause();
        }
      }

      // Live streams cannot seek to a specific VOD timestamp
      if (caps.isLive || !caps.canSeek) return;

      // 2. Smooth Rate Nudging for micro-drifts (0.5s - 2.5s) to avoid disruptive seeking
      if (caps.canSyncRate && targetStatus === 'playing') {
        if (drift >= 0.5 && drift <= 2.5) {
          if (current < expectedTime) {
            adapterRef.current.setRate?.(1.1); // Gently catch up
          } else {
            adapterRef.current.setRate?.(0.95); // Gently slow down
          }
          return;
        } else if (drift < 0.3) {
          adapterRef.current.setRate?.(rate || 1.0); // Back to normal
        }
      }

      // 3. Hard Seek for large drift (> 2.5s) with a 3.5s cooldown guard
      const now = Date.now();
      if (drift > 2.5 && now - lastSeekTimestampRef.current > 3500 && !isBuffering) {
        lastSeekTimestampRef.current = now;
        markRemoteAction();
        adapterRef.current.seekTo(expectedTime);
      }
    },
    [isHost, isReady, isPlaying, isBuffering, markRemoteAction]
  );

  // Periodic drift monitor for viewers every 2 seconds
  useEffect(() => {
    if (!authoritativePlayback || isHost || !isReady) return;

    const interval = setInterval(() => {
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
    }, 2000);

    return () => clearInterval(interval);
  }, [
    authoritativePlayback?.status,
    authoritativePlayback?.position,
    authoritativePlayback?.updatedAt,
    authoritativePlayback?.playbackRate,
    isHost,
    isReady,
    syncWithAuthoritative,
  ]);

  // Immediate sync when host status changes (Play/Pause/Rate/Video)
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
    authoritativePlayback?.playbackRate,
    isReady,
    isHost,
    activeVideoId,
    syncWithAuthoritative,
  ]);

  // Mouse inactivity controls toggle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const handleTogglePlay = () => {
    if (!isHost) return;

    // For external playback mode, toggle authoritative room playback state directly
    if (activePlaybackMode === 'external') {
      if (isPlaying) {
        setIsPlaying(false);
        onHostPause(currentTime);
      } else {
        setIsPlaying(true);
        onHostPlay(currentTime);
      }
      return;
    }

    if (!adapterRef.current) return;
    if (isPlaying) {
      adapterRef.current.pause();
    } else {
      adapterRef.current.play();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!capabilities.canSeek || !adapterRef.current) return;
    const val = parseFloat(e.target.value);
    adapterRef.current.seekTo(val);
    if (isHost) {
      onHostSeek(val);
    }
  };

  const skipSeconds = (delta: number) => {
    if (!capabilities.canSeek || !adapterRef.current) return;
    const target = Math.max(0, Math.min(duration, currentTime + delta));
    adapterRef.current.seekTo(target);
    if (isHost) {
      onHostSeek(target);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    setIsMuted(val === 0);
    setIsAutoplayMuted(false);
    if (adapterRef.current) {
      adapterRef.current.setVolume(val);
      adapterRef.current.setMuted(val === 0);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setIsAutoplayMuted(false);
    if (adapterRef.current) {
      adapterRef.current.setMuted(nextMuted);
    }
  };

  const handleManualSync = () => {
    setIsAutoplayMuted(false);
    setIsMuted(false);
    if (adapterRef.current) {
      adapterRef.current.setMuted(false);
      adapterRef.current.setVolume(volume);
    }
    if (!authoritativePlayback) return;
    const now = Date.now();
    let expected = authoritativePlayback.position;
    if (authoritativePlayback.status === 'playing') {
      expected += (now - authoritativePlayback.updatedAt) / 1000;
    }
    syncWithAuthoritative(expected, authoritativePlayback.status, authoritativePlayback.playbackRate);
  };

  const toggleFullscreen = () => {
    if (!playerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const meta = PROVIDER_META[activeProvider] || PROVIDER_META.youtube;

  return (
    <div
      ref={playerWrapperRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-center items-center group select-none"
    >
      {/* Provider Player Canvas */}
      <div className="w-full h-full relative aspect-video flex items-center justify-center">
        {activePlaybackMode === 'external' ? (
          <ExternalPlaybackView
            url={videoUrl || activeVideoId}
            title={meta.name}
            isHost={isHost}
            hostName={hostName}
            compatibility={activeCompatibility}
            authoritativePlayback={authoritativePlayback}
            onTogglePlay={handleTogglePlay}
          />
        ) : (
          <>
            {activeProvider === 'youtube' && (
              <YouTubeAdapter
                ref={adapterRef}
                videoId={activeVideoId}
                callbacks={callbacks}
              />
            )}

            {(activeProvider === 'direct' || activeProvider === 'hls' || activeProvider === 'dash') && (
              <Html5Adapter
                ref={adapterRef}
                url={activeMediaUrl}
                format={activeProvider as any}
                callbacks={callbacks}
              />
            )}

            {activeProvider === 'vimeo' && (
              <VimeoAdapter
                ref={adapterRef}
                videoId={activeVideoId}
                callbacks={callbacks}
              />
            )}

            {activeProvider === 'dailymotion' && (
              <DailymotionAdapter
                ref={adapterRef}
                videoId={activeVideoId}
                callbacks={callbacks}
              />
            )}

            {activeProvider === 'twitch' && (
              <TwitchAdapter
                ref={adapterRef}
                videoId={activeVideoId}
                callbacks={callbacks}
              />
            )}

            {(activeProvider === 'generic_embed' ||
              activeProvider === 'gdrive' ||
              activeProvider === 'streamable' ||
              activeProvider === 'loom' ||
              activeProvider === 'wistia') && (
              <GenericEmbedAdapter
                ref={adapterRef}
                embedUrl={
                  activeProvider === 'gdrive'
                    ? `https://drive.google.com/file/d/${activeVideoId}/preview`
                    : activeProvider === 'streamable'
                    ? `https://streamable.com/e/${activeVideoId}`
                    : activeProvider === 'loom'
                    ? `https://www.loom.com/embed/${activeVideoId}`
                    : activeProvider === 'wistia'
                    ? `https://fast.wistia.net/embed/iframe/${activeVideoId}`
                    : activeMediaUrl || activeVideoId
                }
                callbacks={callbacks}
              />
            )}

            {/* Viewer transparent click layer: clicking anywhere syncs & unmutes playback */}
            {!isHost && (
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                title="Click to sync and unmute playback"
                onClick={handleManualSync}
              />
            )}
          </>
        )}
      </div>

      {/* Big Interactive Center Play Button for Host when paused (only for in-frame players) */}
      {isHost && !isPlaying && activePlaybackMode !== 'external' && (
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

      {/* Prominent Overlay for Viewer when Host is Playing but Viewer is paused (only for in-frame players) */}
      {!isHost && authoritativePlayback?.status === 'playing' && !isPlaying && activePlaybackMode !== 'external' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleManualSync();
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 hover:bg-black/55 transition-all cursor-pointer backdrop-blur-[2px] p-6 text-center animate-fade-in"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center mb-3 shadow-2xl shadow-brand-500/50 animate-pulse">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            Host {hostName} started playback!
          </h3>
          <p className="text-xs text-gray-300 max-w-sm mb-4">
            Tap anywhere to sync live with {meta.name} audio and video.
          </p>
          <span className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/30">
            Tap to Watch Now
          </span>
        </button>
      )}

      {/* Floating Unmute Banner for Viewer when video is playing muted due to browser policy */}
      {!isHost && isPlaying && (isMuted || isAutoplayMuted) && (
        <div className="absolute top-4 right-4 z-30 animate-bounce">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleManualSync();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-xl shadow-brand-500/50 border border-white/20 transition-all hover:scale-105"
          >
            <Volume2 className="w-4 h-4 fill-white animate-pulse" />
            <span>Tap to Unmute Audio</span>
          </button>
        </div>
      )}

      {/* Floating Live Reactions Over Video */}
      <ReactionsOverlay reactions={reactions} />

      {/* Top Floating Badges: Provider & Sync Status */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 pointer-events-none">
        <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold border backdrop-blur-md shadow-md ${meta.badgeBg}`}>
          {meta.name}
        </span>
        {COMPATIBILITY_META[activeCompatibility as keyof typeof COMPATIBILITY_META] && (
          <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold border backdrop-blur-md shadow-md ${COMPATIBILITY_META[activeCompatibility as keyof typeof COMPATIBILITY_META].badgeClass}`}>
            {COMPATIBILITY_META[activeCompatibility as keyof typeof COMPATIBILITY_META].label}
          </span>
        )}
        {capabilities.isLive ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            LIVE
          </span>
        ) : (
          !isHost && activePlaybackMode !== 'external' && (
            <span
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium border backdrop-blur-md transition-colors ${
                driftSeconds < 0.5
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              <Zap className="w-3 h-3" />
              {driftSeconds < 0.5 ? 'In Sync' : `Syncing (${driftSeconds.toFixed(1)}s)`}
            </span>
          )
        )}
      </div>

      {/* Bottom Floating Reactions Bar */}
      <div className="absolute bottom-16 sm:bottom-20 z-20 pointer-events-auto">
        <ReactionBar onTriggerReaction={onTriggerReaction} />
      </div>

      {/* Video Player Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 sm:p-4 transition-opacity duration-300 z-25 flex flex-col gap-2 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress / Seek bar */}
        {capabilities.canSeek ? (
          <div className="relative group/seeker flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              disabled={!isHost}
              className={`w-full h-1.5 sm:h-2 bg-white/20 rounded-lg appearance-none transition-all ${
                isHost ? 'cursor-pointer hover:h-2.5 accent-brand-500' : 'cursor-default accent-gray-400'
              }`}
            />
          </div>
        ) : (
          <div className="w-full h-1 bg-red-500/40 rounded-full overflow-hidden">
            <div className="w-full h-full bg-red-500 animate-pulse" />
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls: Play/Pause, Skips, Timestamp */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {isHost ? (
              <button
                onClick={handleTogglePlay}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
                title={isPlaying ? 'Pause for everyone' : 'Play for everyone'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-white" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-white" />
                )}
              </button>
            ) : (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-gray-300 text-[10px] sm:text-xs font-medium"
                title="Only host can control playback for the room"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Host Controls</span>
              </div>
            )}

            {isHost && capabilities.canSeek && (
              <>
                <button
                  onClick={() => skipSeconds(-10)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:block"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-4 h-4 text-gray-300" />
                </button>
                <button
                  onClick={() => skipSeconds(10)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:block"
                  title="Forward 10 seconds"
                >
                  <RotateCw className="w-4 h-4 text-gray-300" />
                </button>
              </>
            )}

            {/* Time Display */}
            <div className="text-[11px] sm:text-xs font-mono text-gray-300 ml-1">
              {capabilities.isLive ? (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                  LIVE STREAM
                </span>
              ) : (
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Next Queue, Volume, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isHost && hasQueueItem && onPlayNextQueue && (
              <button
                onClick={onPlayNextQueue}
                className="flex items-center gap-1 px-2 py-1 rounded bg-brand-600/80 hover:bg-brand-600 text-white text-xs font-medium transition-all"
                title="Play Next in Queue"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Next in Queue</span>
              </button>
            )}

            {/* Volume & Mute */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={handleToggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-200" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-12 sm:w-20 h-1 sm:h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-gray-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
