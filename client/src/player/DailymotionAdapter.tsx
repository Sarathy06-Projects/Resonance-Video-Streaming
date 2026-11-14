import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { PlayerAdapter, AdapterCallbacks, PlayerCapabilities } from './types';

interface DailymotionAdapterProps {
  videoId: string;
  callbacks: AdapterCallbacks;
}

export const DailymotionAdapter = forwardRef<PlayerAdapter, DailymotionAdapterProps>(
  ({ videoId, callbacks }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const currentTimeRef = useRef<number>(0);
    const durationRef = useRef<number>(0);

    const cleanId = videoId.replace(/^x/, 'x').split(/[\?&#]/)[0];

    const postToPlayer = (msg: string | object) => {
      try {
        if (!iframeRef.current || !iframeRef.current.contentWindow) return;
        const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      play: async () => {
        postToPlayer('play');
        postToPlayer({ command: 'play' });
      },
      pause: () => {
        postToPlayer('pause');
        postToPlayer({ command: 'pause' });
      },
      seekTo: (seconds: number) => {
        postToPlayer(`seek:${seconds}`);
        postToPlayer({ command: 'seek', value: seconds });
      },
      setRate: (_rate: number) => {
        // Dailymotion iframe embed does not support variable playback rates via postMessage
      },
      setVolume: (vol: number) => {
        postToPlayer(`volume:${vol / 100}`);
        postToPlayer({ command: 'volume', value: vol / 100 });
      },
      setMuted: (muted: boolean) => {
        postToPlayer(muted ? 'mute' : 'unmute');
        postToPlayer({ command: muted ? 'mute' : 'unmute' });
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
        canSyncRate: false,
        isLive: false,
      }),
      destroy: () => {
        if (iframeRef.current) {
          iframeRef.current.src = 'about:blank';
        }
      },
    }));

    useEffect(() => {
      const handleMessage = (e: MessageEvent) => {
        if (!e.data) return;

        let data = e.data;
        if (typeof data === 'string' && data.startsWith('{')) {
          try {
            data = JSON.parse(data);
          } catch {}
        }

        const eventType = data.event || data.type || (typeof data === 'string' ? data : '');

        if (eventType === 'apiready' || eventType === 'playerready' || eventType === 'canplay') {
          callbacks.onReady();
        } else if (eventType === 'play' || eventType === 'playing') {
          callbacks.onPlay(currentTimeRef.current);
        } else if (eventType === 'pause') {
          callbacks.onPause(currentTimeRef.current);
        } else if (eventType === 'seeked') {
          callbacks.onSeek(currentTimeRef.current);
        } else if (eventType === 'timeupdate') {
          const t = Number(data.time || data.currentTime || 0);
          const d = Number(data.duration || durationRef.current || 0);
          currentTimeRef.current = t;
          if (d > 0) durationRef.current = d;
          callbacks.onTimeUpdate(t, d);
        } else if (eventType === 'durationchange') {
          durationRef.current = Number(data.duration || 0);
        } else if (eventType === 'end' || eventType === 'ended') {
          callbacks.onEnded();
        } else if (eventType === 'waiting' || eventType === 'buffering') {
          callbacks.onBuffering(true);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [callbacks]);

    const embedUrl = `https://www.dailymotion.com/embed/video/${cleanId}?api=postMessage&autoplay=0&controls=0&mute=0&ui-start-screen-info=0&queue-autoplay-next=0&sharing-enable=0`;

    return (
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Dailymotion Player"
        allow="autoplay; fullscreen; picture-in-picture"
        className="w-full h-full border-0 pointer-events-auto bg-black"
        onLoad={() => callbacks.onReady()}
      />
    );
  }
);
DailymotionAdapter.displayName = 'DailymotionAdapter';
