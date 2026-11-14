import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface UseYouTubePlayerProps {
  videoId: string;
  isHost: boolean;
  onLocalPlay?: (position: number) => void;
  onLocalPause?: (position: number) => void;
  onLocalSeek?: (position: number) => void;
  onVideoEnd?: () => void;
  onPlayerReady?: () => void;
}

export function useYouTubePlayer({
  videoId,
  isHost,
  onLocalPlay,
  onLocalPause,
  onLocalSeek,
  onVideoEnd,
  onPlayerReady,
}: UseYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const playerStateRef = useRef<number>(-1);
  const lastSeekTimeRef = useRef<number>(0);
  const pendingPlayRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<{ expectedPosition: number; targetStatus: string; rate: number } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Remote command guard: ignore local events triggered by remote commands
  const isRemoteActionRef = useRef<boolean>(false);
  const remoteActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRemoteAction = useCallback(() => {
    isRemoteActionRef.current = true;
    if (remoteActionTimeoutRef.current) clearTimeout(remoteActionTimeoutRef.current);
    remoteActionTimeoutRef.current = setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 1200);
  }, []);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!window.YT) {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }
  }, []);

  // Initialize player instance
  useEffect(() => {
    let checkInterval: any = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !containerRef.current) return false;

      // Clean up previous player if exists
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch (e) {}
        playerRef.current = null;
      }

      // Create a fresh inner mount target so containerRef.current is NEVER removed from React DOM
      const mountId = `yt-mount-${Math.random().toString(36).substring(2, 9)}`;
      containerRef.current.innerHTML = `<div id="${mountId}" style="width:100%;height:100%"></div>`;

      try {
        playerRef.current = new window.YT.Player(mountId, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: isHost ? 1 : 0,
            disablekb: isHost ? 0 : 1,
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              setIsReady(true);
              const dur = event.target.getDuration?.() || 0;
              setDuration(dur);
              event.target.setVolume?.(volume);

              // If host clicked play before ready
              if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                try {
                  event.target.playVideo?.();
                } catch (e) {}
              }

              // If viewer had a pending authoritative sync
              if (pendingSyncRef.current) {
                const { expectedPosition, targetStatus, rate } = pendingSyncRef.current;
                pendingSyncRef.current = null;
                syncWithAuthoritative(expectedPosition, targetStatus as any, rate);
              }

              onPlayerReady?.();
            },
            onStateChange: (event: any) => {
              const state = event.data;
              playerStateRef.current = state;
              const time = event.target.getCurrentTime?.() || 0;
              setCurrentTime(time);

              if (state === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setIsAutoplayBlocked(false);
                if (isHost && !isRemoteActionRef.current) {
                  onLocalPlay?.(time);
                }
              } else if (state === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                if (isHost && !isRemoteActionRef.current) {
                  onLocalPause?.(time);
                }
              } else if (state === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                onVideoEnd?.();
              }
            },
            onError: (err: any) => {
              console.warn('[YouTube Player Error]', err.data);
            },
          },
        });
        return true;
      } catch (err) {
        console.error('[YouTube Init Error]', err);
        return false;
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevHandler) prevHandler();
        initPlayer();
      };
      // Poll fallback in case window callback already passed
      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          if (initPlayer()) clearInterval(checkInterval);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (remoteActionTimeoutRef.current) clearTimeout(remoteActionTimeoutRef.current);
    };
  }, [videoId, isHost]);

  // Track playback time interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && isReady) {
        try {
          const t = playerRef.current.getCurrentTime();
          setCurrentTime(t);
          const dur = playerRef.current.getDuration();
          if (dur && dur !== duration) setDuration(dur);
        } catch (e) {}
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isReady, duration]);

  // Host / Remote Actions
  const play = useCallback(() => {
    if (!playerRef.current) {
      pendingPlayRef.current = true;
      return;
    }
    try {
      if (typeof playerRef.current.playVideo === 'function') {
        const playPromise = playerRef.current.playVideo();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.warn('[Autoplay/Play Error]', err);
            setIsAutoplayBlocked(true);
          });
        }
        setIsPlaying(true);
      } else {
        pendingPlayRef.current = true;
      }
    } catch (e) {
      console.warn('[Play Exception]', e);
      setIsAutoplayBlocked(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
    } catch (e) {}
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!playerRef.current) return;
      try {
        if (typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(seconds, true);
        }
        setCurrentTime(seconds);
        if (isHost && !isRemoteActionRef.current) {
          onLocalSeek?.(seconds);
        }
      } catch (e) {}
    },
    [isHost, onLocalSeek]
  );

  const setRate = useCallback(
    (rate: number) => {
      if (!playerRef.current) return;
      try {
        if (typeof playerRef.current.setPlaybackRate === 'function') {
          playerRef.current.setPlaybackRate(rate);
          setPlaybackRate(rate);
        }
      } catch (e) {}
    },
    []
  );

  const changeVolume = useCallback((val: number) => {
    setVolume(val);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(val);
        if (val === 0) {
          playerRef.current.mute();
          setIsMuted(true);
        } else {
          playerRef.current.unMute();
          setIsMuted(false);
        }
      } catch (e) {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(volume || 80);
        setIsMuted(false);
        setIsAutoplayBlocked(false);
      } else {
        playerRef.current.mute?.();
        setIsMuted(true);
      }
    } catch (e) {}
  }, [isMuted, volume]);

  const unMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.unMute?.();
      playerRef.current.setVolume?.(volume || 80);
      setIsMuted(false);
      setIsAutoplayBlocked(false);
    } catch (e) {}
  }, [volume]);

  // Drift correction & incoming remote sync logic with Buffer Protection & Smooth Rate Adjustment
  const syncWithAuthoritative = useCallback(
    (expectedPosition: number, targetStatus: 'playing' | 'paused' | 'ended', rate = 1.0) => {
      if (!playerRef.current || !isReady) {
        pendingSyncRef.current = { expectedPosition, targetStatus, rate };
        return;
      }

      const now = Date.now();
      const currentState = playerStateRef.current;

      // 1. Target is PAUSED
      if (targetStatus === 'paused') {
        if (currentState === 1 || isPlaying) {
          markRemoteAction();
          try {
            playerRef.current.pauseVideo?.();
            setIsPlaying(false);
          } catch {}
        }
        try {
          const current = playerRef.current.getCurrentTime?.() || 0;
          if (Math.abs(current - expectedPosition) > 1.5) {
            markRemoteAction();
            playerRef.current.seekTo?.(expectedPosition, true);
            setCurrentTime(expectedPosition);
          }
        } catch {}
        return;
      }

      // 2. Target is PLAYING
      // If player is not currently playing or buffering, resume playback
      if (currentState !== 1 && currentState !== 3) {
        markRemoteAction();
        try {
          const playPromise = playerRef.current.playVideo?.();
          setIsPlaying(true);
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              // Muted autoplay fallback
              try {
                playerRef.current.mute?.();
                playerRef.current.playVideo?.();
                setIsMuted(true);
                setIsAutoplayBlocked(true);
              } catch {}
            });
          }
        } catch {}
      }

      // 3. BUFFERING GUARD: If player is actively buffering (State 3), NEVER seek!
      // Seeking while buffering interrupts download chunks and causes infinite buffering wheel!
      if (currentState === 3) {
        return;
      }

      // 4. SEEK COOLDOWN GUARD: Ensure at least 3.5s between hard seeks
      if (now - lastSeekTimeRef.current < 3500) {
        return;
      }

      try {
        const current = playerRef.current.getCurrentTime?.() || 0;
        const drift = Math.abs(current - expectedPosition);

        // A. Small drift (< 2.5 seconds): DO NOT SEEK.
        // Minor sub-2s differences between client CDN edges are completely normal and imperceptible.
        if (drift < 2.5) {
          if (playbackRate !== rate) {
            setRate(rate);
          }
          return;
        }

        // B. Moderate drift (2.5s to 4.5s): Smooth dynamic playback rate adjustment (ZERO BUFFERING!)
        if (drift >= 2.5 && drift <= 4.5) {
          if (current < expectedPosition) {
            // Viewer is slightly behind host: speed up slightly to catch up smoothly
            setRate(1.1);
          } else {
            // Viewer is slightly ahead of host: slow down slightly
            setRate(0.95);
          }
          return;
        }

        // C. Large drift (> 4.5 seconds): Host scrubbed chapters or skipped far ahead
        lastSeekTimeRef.current = now;
        markRemoteAction();
        playerRef.current.seekTo?.(expectedPosition, true);
        setCurrentTime(expectedPosition);
        setRate(rate);
      } catch (e) {}
    },
    [isReady, isPlaying, playbackRate, setRate, markRemoteAction]
  );

  return {
    containerRef,
    player: playerRef.current,
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
    markRemoteAction,
  };
}
