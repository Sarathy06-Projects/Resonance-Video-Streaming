import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Player from '@vimeo/player';
import { PlayerAdapter, AdapterCallbacks, PlayerCapabilities } from './types';

interface VimeoAdapterProps {
  videoId: string;
  callbacks: AdapterCallbacks;
}

export const VimeoAdapter = forwardRef<PlayerAdapter, VimeoAdapterProps>(
  ({ videoId, callbacks }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<Player | null>(null);
    const currentTimeRef = useRef<number>(0);
    const durationRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (!playerRef.current) return;
        try {
          await playerRef.current.play();
        } catch {
          // Autoplay policy fallback: mute and retry
          try {
            await playerRef.current.setMuted(true);
            await playerRef.current.play();
          } catch {}
        }
      },
      pause: () => {
        playerRef.current?.pause().catch(() => {});
      },
      seekTo: (seconds: number) => {
        playerRef.current?.setCurrentTime(seconds).catch(() => {});
      },
      setRate: (rate: number) => {
        playerRef.current?.setPlaybackRate(rate).catch(() => {});
      },
      setVolume: (vol: number) => {
        playerRef.current?.setVolume(Math.max(0, Math.min(1, vol / 100))).catch(() => {});
      },
      setMuted: (muted: boolean) => {
        playerRef.current?.setMuted(muted).catch(() => {});
      },
      getCurrentTime: () => {
        return currentTimeRef.current;
      },
      getDuration: () => {
        return durationRef.current;
      },
      getCapabilities: (): PlayerCapabilities => ({
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      }),
      destroy: () => {
        if (playerRef.current) {
          playerRef.current.destroy().catch(() => {});
          playerRef.current = null;
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current || !videoId) return;

      // Clean up previous instance
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }

      containerRef.current.innerHTML = '';
      const vimeoId = parseInt(videoId.replace(/\D/g, ''), 10);
      if (isNaN(vimeoId)) {
        callbacks.onError('Invalid Vimeo numeric ID');
        return;
      }

      const player = new Player(containerRef.current, {
        id: vimeoId,
        controls: false,
        responsive: true,
        autoplay: false,
        dnt: true,
      });
      playerRef.current = player;

      player.ready().then(async () => {
        callbacks.onReady();
        const dur = await player.getDuration().catch(() => 0);
        durationRef.current = dur;
      });

      player.on('play', (data) => {
        currentTimeRef.current = data.seconds;
        callbacks.onPlay(data.seconds);
      });

      player.on('pause', (data) => {
        currentTimeRef.current = data.seconds;
        callbacks.onPause(data.seconds);
      });

      player.on('seeked', (data) => {
        currentTimeRef.current = data.seconds;
        callbacks.onSeek(data.seconds);
      });

      player.on('timeupdate', (data) => {
        currentTimeRef.current = data.seconds;
        durationRef.current = data.duration;
        callbacks.onTimeUpdate(data.seconds, data.duration);
      });

      player.on('ended', () => {
        callbacks.onEnded();
      });

      player.on('bufferstart', () => {
        callbacks.onBuffering(true);
      });

      player.on('bufferend', () => {
        callbacks.onBuffering(false);
      });

      player.on('error', (data) => {
        callbacks.onError(data.message || 'Vimeo playback error');
      });

      return () => {
        player.destroy().catch(() => {});
        playerRef.current = null;
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
VimeoAdapter.displayName = 'VimeoAdapter';
