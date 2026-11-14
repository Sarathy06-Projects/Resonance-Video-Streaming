import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { PlayerAdapter, AdapterCallbacks, PlayerCapabilities } from './types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubeAdapterProps {
  videoId: string;
  callbacks: AdapterCallbacks;
}

export const YouTubeAdapter = forwardRef<PlayerAdapter, YouTubeAdapterProps>(
  ({ videoId, callbacks }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const durationRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      play: async () => {
        try {
          playerRef.current?.playVideo?.();
        } catch {
          try {
            playerRef.current?.mute?.();
            playerRef.current?.playVideo?.();
          } catch {}
        }
      },
      pause: () => {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      },
      seekTo: (seconds: number) => {
        try {
          playerRef.current?.seekTo?.(seconds, true);
        } catch {}
      },
      setRate: (rate: number) => {
        try {
          playerRef.current?.setPlaybackRate?.(rate);
        } catch {}
      },
      setVolume: (vol: number) => {
        try {
          playerRef.current?.setVolume?.(vol);
        } catch {}
      },
      setMuted: (muted: boolean) => {
        try {
          if (muted) {
            playerRef.current?.mute?.();
          } else {
            playerRef.current?.unMute?.();
          }
        } catch {}
      },
      getCurrentTime: () => {
        try {
          return playerRef.current?.getCurrentTime?.() || 0;
        } catch {
          return 0;
        }
      },
      getDuration: () => {
        try {
          return durationRef.current || playerRef.current?.getDuration?.() || 0;
        } catch {
          return 0;
        }
      },
      getCapabilities: (): PlayerCapabilities => ({
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      }),
      destroy: () => {
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        if (playerRef.current) {
          try {
            playerRef.current.destroy?.();
          } catch {}
          playerRef.current = null;
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initPlayer = () => {
        if (!window.YT || !window.YT.Player || !containerRef.current || !isMounted) return;

        if (playerRef.current) {
          try {
            playerRef.current.destroy?.();
          } catch {}
          playerRef.current = null;
        }

        const mountId = `yt-adapter-${Math.random().toString(36).substring(2, 9)}`;
        containerRef.current.innerHTML = `<div id="${mountId}" style="width:100%;height:100%"></div>`;

        try {
          playerRef.current = new window.YT.Player(mountId, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              enablejsapi: 1,
              fs: 1,
              modestbranding: 1,
              rel: 0,
              iv_load_policy: 3,
              playsinline: 1,
            },
            events: {
              onReady: (event: any) => {
                if (!isMounted) return;
                callbacks.onReady();
                const dur = event.target.getDuration?.() || 0;
                durationRef.current = dur;

                if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
                timeIntervalRef.current = setInterval(() => {
                  if (!playerRef.current || !isMounted) return;
                  const cur = playerRef.current.getCurrentTime?.() || 0;
                  const d = playerRef.current.getDuration?.() || durationRef.current;
                  callbacks.onTimeUpdate(cur, d);
                }, 400);
              },
              onStateChange: (event: any) => {
                if (!isMounted) return;
                const state = event.data;
                const cur = playerRef.current?.getCurrentTime?.() || 0;

                if (state === 1) {
                  // PLAYING
                  callbacks.onBuffering(false);
                  callbacks.onPlay(cur);
                } else if (state === 2) {
                  // PAUSED
                  callbacks.onBuffering(false);
                  callbacks.onPause(cur);
                } else if (state === 3) {
                  // BUFFERING
                  callbacks.onBuffering(true);
                } else if (state === 0) {
                  // ENDED
                  callbacks.onEnded();
                }
              },
              onError: (err: any) => {
                callbacks.onError(`YouTube player error: ${err.data}`);
              },
            },
          });
        } catch (e: any) {
          callbacks.onError(e?.message || 'Failed to initialize YouTube player');
        }
      };

      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const first = document.getElementsByTagName('script')[0];
        first?.parentNode?.insertBefore(tag, first);

        const check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            if (isMounted) initPlayer();
          }
        }, 100);

        return () => {
          isMounted = false;
          clearInterval(check);
          if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        };
      } else {
        initPlayer();
      }

      return () => {
        isMounted = false;
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        if (playerRef.current) {
          try {
            playerRef.current.destroy?.();
          } catch {}
          playerRef.current = null;
        }
      };
    }, [videoId]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-black overflow-hidden [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
      />
    );
  }
);
YouTubeAdapter.displayName = 'YouTubeAdapter';
