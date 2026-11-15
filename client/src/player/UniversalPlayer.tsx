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
  Upload,
} from 'lucide-react';
import { UniversalPlayerProps, PlayerAdapter, PlaybackCapabilities, CompatibilityStatus } from './types';
import { detectProviderQuick, PROVIDER_META, VideoProviderType } from '../utils/resolver';
// Removed floating ReactionsOverlay and ReactionBar from video player (reactions belong to chat only)
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
  const localBlobUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (videoUrl?.startsWith('blob:')) return videoUrl;
    if (activeVideoId?.startsWith('blob:')) return activeVideoId;
    const target = videoUrl || activeVideoId || '';
    if (target.startsWith('local://')) {
      const raw = target.replace(/^local:\/\//, '');
      const decoded = decodeURIComponent(raw);
      return (
        sessionStorage.getItem(`together_local_blob_${raw}`) ||
        sessionStorage.getItem(`together_local_blob_${decoded}`) ||
        localStorage.getItem(`together_local_blob_${raw}`) ||
        localStorage.getItem(`together_local_blob_${decoded}`) ||
        sessionStorage.getItem('together_active_local_blob') ||
        ''
      );
    }
    return '';
  }, [videoUrl, activeVideoId]);

  const activeMediaUrl =
    localBlobUrl ||
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
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);

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
    return {
      canSeek: true,
      canPause: true,
      canSyncRate: activeProvider === 'youtube' || activeProvider === 'direct' || activeProvider === 'vimeo',
      isLive: false,
    };
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
            adapterRef.current.setRate?.(1.08); // Gently catch up
          } else {
            adapterRef.current.setRate?.(0.96); // Gently slow down
          }
          return;
        } else if (drift < 0.3) {
          adapterRef.current.setRate?.(rate || 1.0); // Back to normal
        }
      }

      // 3. Hard Seek for large drift (> 2.5s) with cooldown guard
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
    }, 3200);
  };

  const handleTogglePlay = () => {
    if (!isHost) return;

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
    if (!isHost || !capabilities.canSeek || !adapterRef.current) return;
    const target = Math.max(0, Math.min(duration, currentTime + delta));
    adapterRef.current.seekTo(target);
    onHostSeek(target);
  };

  const handleToggleMute = () => {
    if (!adapterRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    setIsAutoplayMuted(false);
    adapterRef.current.setMuted(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!adapterRef.current) return;
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      adapterRef.current.setMuted(true);
    } else {
      setIsMuted(false);
      adapterRef.current.setMuted(false);
      adapterRef.current.setVolume(val);
    }
  };

  const handleToggleFullscreen = () => {
    if (!playerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleManualSync = () => {
    if (!adapterRef.current) return;
    setIsAutoplayMuted(false);
    setIsMuted(false);
    adapterRef.current.setMuted(false);
    adapterRef.current.setVolume(80);

    if (authoritativePlayback) {
      const now = Date.now();
      let expected = authoritativePlayback.position;
      if (authoritativePlayback.status === 'playing') {
        const elapsed = (now - authoritativePlayback.updatedAt) / 1000;
        expected += elapsed * (authoritativePlayback.playbackRate || 1.0);
      }
      if (authoritativePlayback.status === 'playing') {
        adapterRef.current.play();
      }
      if (capabilities.canSeek) {
        adapterRef.current.seekTo(expected);
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const meta = PROVIDER_META[activeProvider] || PROVIDER_META.youtube;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playerWrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      className="relative w-full h-full bg-black select-none overflow-hidden group/player"
    >
      {/* Media Engine Layer */}
      <div className="absolute inset-0 w-full h-full">
        {activePlaybackMode === 'external' ? (
          <ExternalPlaybackView
            url={activeMediaUrl || videoUrl || activeVideoId}
            title={activeVideoId}
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
            {activeProvider === 'direct' &&
            (videoUrl?.startsWith('local://') || activeVideoId?.startsWith('local://')) &&
            !localBlobUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md z-20">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4 text-indigo-400">
                  <Film className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">
                  Local Video File: {decodeURIComponent((videoUrl || activeVideoId || '').replace(/^local:\/\//, ''))}
                </h3>
                <p className="text-xs text-white/50 max-w-md mb-5 leading-relaxed">
                  This room is watching a local video file. Select the matching video file from your device to join frame-accurate synchronized playback.
                </p>
                <label className="px-4 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-xs tracking-tight cursor-pointer shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span>Select Video File</span>
                  <input
                    type="file"
                    accept="video/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.ogg,.mkv,.mov,.m4v"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const blob = URL.createObjectURL(file);
                      const raw = (videoUrl || activeVideoId || '').replace(/^local:\/\//, '');
                      const decoded = decodeURIComponent(raw);
                      sessionStorage.setItem(`together_local_blob_${raw}`, blob);
                      sessionStorage.setItem(`together_local_blob_${decoded}`, blob);
                      sessionStorage.setItem('together_active_local_blob', blob);
                      window.location.reload();
                    }}
                  />
                </label>
              </div>
            ) : activeProvider === 'direct' ? (
              <Html5Adapter
                ref={adapterRef}
                url={activeMediaUrl}
                format="direct"
                callbacks={callbacks}
              />
            ) : null}
            {activeProvider === 'hls' && (
              <Html5Adapter
                ref={adapterRef}
                url={activeMediaUrl}
                format="hls"
                callbacks={callbacks}
              />
            )}
            {activeProvider === 'dash' && (
              <Html5Adapter
                ref={adapterRef}
                url={activeMediaUrl}
                format="dash"
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
              activeProvider === 'wistia' ||
              (activeProvider as string) === 'archive_org') && (
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

            {/* Viewer click layer: click anywhere to sync & unmute */}
            {!isHost && (
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                title="Click to sync playback"
                onClick={handleManualSync}
              />
            )}
          </>
        )}
      </div>

      {/* Center Play Button for Host when Paused (Refined Frosted Glass) */}
      {isHost && !isPlaying && activePlaybackMode !== 'external' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePlay();
          }}
          className="absolute inset-0 z-15 flex items-center justify-center bg-black/25 hover:bg-black/20 transition-all cursor-pointer group/centerplay"
          title="Play for room"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-2xl transition-all transform group-hover/centerplay:scale-105 active:scale-95">
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1 text-white" />
          </div>
        </button>
      )}

      {/* Viewer Overlay when Host is Playing but Viewer is Paused */}
      {!isHost && authoritativePlayback?.status === 'playing' && !isPlaying && activePlaybackMode !== 'external' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleManualSync();
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 hover:bg-black/40 transition-all cursor-pointer backdrop-blur-sm p-6 text-center"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center mb-3 shadow-2xl backdrop-blur-md transition-transform hover:scale-105">
            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white ml-0.5 text-white" />
          </div>
          <h3 className="text-sm sm:text-base font-medium text-white mb-1 tracking-tight">
            Host started playback
          </h3>
          <p className="text-xs text-white/60 max-w-xs mb-3">
            Click anywhere to jump in and sync with the room.
          </p>
          <span className="px-4 py-1.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm transition-all">
            Join Playback
          </span>
        </button>
      )}

      {/* Floating Unmute Banner */}
      {!isHost && isPlaying && (isMuted || isAutoplayMuted) && (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleManualSync();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-medium backdrop-blur-xl border border-white/15 shadow-lg transition-all hover:scale-[1.02]"
          >
            <Volume2 className="w-3.5 h-3.5 fill-white" />
            <span>Click to Unmute</span>
          </button>
        </div>
      )}



      {/* Video Player Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 sm:px-5 pb-3 pt-6 transition-opacity duration-300 z-25 flex flex-col gap-2 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Bar */}
        {capabilities.canSeek ? (
          <div className="relative group/seeker flex items-center h-4 cursor-pointer">
            {/* Background track */}
            <div className="w-full h-1 group-hover/seeker:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all relative">
              {/* Progress bar */}
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Range input for precision seeking */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              disabled={!isHost}
              className={`absolute inset-0 w-full h-full opacity-0 ${
                isHost ? 'cursor-pointer' : 'cursor-default'
              }`}
            />
          </div>
        ) : (
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-rose-500/80 animate-pulse" />
          </div>
        )}

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-3 text-white">
          {/* Left Controls: Play/Pause, Rewind, Forward, Time */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isHost ? (
              <button
                onClick={handleTogglePlay}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                )}
              </button>
            ) : (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] text-white/70 text-[10px] font-medium"
                title="Host directs playback"
              >
                <span>Host Controls</span>
              </div>
            )}

            {isHost && capabilities.canSeek && (
              <>
                <button
                  onClick={() => skipSeconds(-10)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white hidden sm:block"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => skipSeconds(10)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white hidden sm:block"
                  title="Forward 10s"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Time Stamp */}
            <div className="text-[11px] font-mono text-white/70 ml-1 select-none">
              {capabilities.isLive ? (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span>
                  {formatTime(currentTime)} <span className="text-white/30">/</span> {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Volume, Sync Dot, Next Queue, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Volume Control with hover slider */}
            <div
              className="flex items-center gap-1 relative"
              onMouseEnter={() => setIsHoveringVolume(true)}
              onMouseLeave={() => setIsHoveringVolume(false)}
            >
              <button
                onClick={handleToggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              {isHoveringVolume && (
                <div className="w-16 sm:w-20 pr-1 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>
              )}
            </div>

            {/* Understated Sync Pill */}
            {!capabilities.isLive && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] text-white/70 text-[10px] font-medium border border-white/[0.06]">
                <span className={`w-1.5 h-1.5 rounded-full ${driftSeconds < 0.5 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{meta.name}</span>
                <span className="text-white/30">•</span>
                <span>{driftSeconds < 0.5 ? 'In Sync' : 'Syncing'}</span>
              </div>
            )}

            {/* Play Next in Queue button (if queue has item & isHost) */}
            {isHost && hasQueueItem && onPlayNextQueue && (
              <button
                onClick={onPlayNextQueue}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                title="Play next video in queue"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
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

export default UniversalPlayer;
