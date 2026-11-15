import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { PlayerAdapter, AdapterCallbacks, PlayerCapabilities } from './types';

declare global {
  interface Window {
    Twitch?: {
      Player: any;
    };
  }
}

interface TwitchAdapterProps {
  videoId: string;
  callbacks: AdapterCallbacks;
}

export const TwitchAdapter = forwardRef<PlayerAdapter, TwitchAdapterProps>(
  ({ videoId, callbacks }, ref) => {
    const containerIdRef = useRef(`twitch-player-${Math.random().toString(36).substring(2, 9)}`);
    const playerRef = useRef<any>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isVod = /^\d+$/.test(videoId);

    useImperativeHandle(ref, () => ({
      play: async () => {
        try {
          playerRef.current?.play();
        } catch {
          try {
            playerRef.current?.setMuted(true);
            playerRef.current?.play();
          } catch {}
        }
      },
      pause: () => {
        try {
          playerRef.current?.pause();
        } catch {}
      },
      seekTo: (seconds: number) => {
        if (isVod && playerRef.current?.seek) {
          try {
            playerRef.current.seek(seconds);
          } catch {}
        }
      },
      setRate: (_rate: number) => {
        // Twitch embed player does not support custom playback rates
      },
      setVolume: (vol: number) => {
        try {
          playerRef.current?.setVolume(Math.max(0, Math.min(1, vol / 100)));
        } catch {}
      },
      setMuted: (muted: boolean) => {
        try {
          playerRef.current?.setMuted(muted);
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
          return playerRef.current?.getDuration?.() || 0;
        } catch {
          return 0;
        }
      },
      getCapabilities: (): PlayerCapabilities => ({
        canSeek: isVod,
        canPause: true,
        canSyncRate: false,
        isLive: !isVod,
      }),
      destroy: () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        const container = document.getElementById(containerIdRef.current);
        if (container) container.innerHTML = '';
        playerRef.current = null;
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initTwitch = () => {
        if (!window.Twitch || !window.Twitch.Player) return;
        const container = document.getElementById(containerIdRef.current);
        if (!container || !isMounted) return;

        container.innerHTML = '';

        const host = window.location.hostname || 'localhost';
        const parents = Array.from(new Set([host, 'www.resonance.org.in', 'resonance.org.in', 'app.resonance.org.in', 'localhost'])).filter(Boolean);

        const options: any = {
          width: '100%',
          height: '100%',
          parent: parents,
          autoplay: false,
          muted: false,
          controls: false,
        };

        if (isVod) {
          options.video = videoId;
        } else {
          options.channel = videoId;
        }

        try {
          const player = new window.Twitch.Player(containerIdRef.current, options);
          playerRef.current = player;

          player.addEventListener(window.Twitch.Player.READY, () => {
            if (!isMounted) return;
            callbacks.onReady();

            // Poll time updates for Twitch VODs
            if (isVod) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = setInterval(() => {
                if (!playerRef.current || !isMounted) return;
                const cur = playerRef.current.getCurrentTime?.() || 0;
                const dur = playerRef.current.getDuration?.() || 0;
                callbacks.onTimeUpdate(cur, dur);
              }, 500);
            }
          });

          player.addEventListener(window.Twitch.Player.PLAY, () => {
            const cur = player.getCurrentTime?.() || 0;
            callbacks.onPlay(cur);
          });

          player.addEventListener(window.Twitch.Player.PAUSE, () => {
            const cur = player.getCurrentTime?.() || 0;
            callbacks.onPause(cur);
          });

          player.addEventListener(window.Twitch.Player.ENDED, () => {
            callbacks.onEnded();
          });

          player.addEventListener(window.Twitch.Player.SEEK, () => {
            const cur = player.getCurrentTime?.() || 0;
            callbacks.onSeek(cur);
          });
        } catch (err: any) {
          callbacks.onError(err?.message || 'Failed to initialize Twitch embed');
        }
      };

      if (!window.Twitch) {
        const scriptId = 'twitch-embed-sdk';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://player.twitch.tv/js/embed/v1.js';
          script.async = true;
          script.onload = () => {
            if (isMounted) initTwitch();
          };
          document.body.appendChild(script);
        } else {
          const interval = setInterval(() => {
            if (window.Twitch?.Player) {
              clearInterval(interval);
              if (isMounted) initTwitch();
            }
          }, 100);
          return () => clearInterval(interval);
        }
      } else {
        initTwitch();
      }

      return () => {
        isMounted = false;
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }, [videoId, isVod]);

    return (
      <div
        id={containerIdRef.current}
        className="w-full h-full flex items-center justify-center bg-black overflow-hidden [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
      />
    );
  }
);
TwitchAdapter.displayName = 'TwitchAdapter';
