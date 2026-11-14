import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { PlayerAdapter, AdapterCallbacks, PlaybackCapabilities } from './types';

interface GenericEmbedAdapterProps {
  embedUrl: string;
  callbacks: AdapterCallbacks;
}

export const GenericEmbedAdapter = forwardRef<PlayerAdapter, GenericEmbedAdapterProps>(
  ({ embedUrl, callbacks }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasFrameError, setHasFrameError] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const postToIframe = (msg: any) => {
      try {
        if (!iframeRef.current || !iframeRef.current.contentWindow) return;
        const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      play: async () => {
        setIsPlaying(true);
        postToIframe({ command: 'play' });
        postToIframe('play');
        callbacks.onPlay(currentTime);
      },
      pause: () => {
        setIsPlaying(false);
        postToIframe({ command: 'pause' });
        postToIframe('pause');
        callbacks.onPause(currentTime);
      },
      seekTo: (seconds: number) => {
        setCurrentTime(seconds);
        postToIframe({ command: 'seek', value: seconds });
        postToIframe(`seek:${seconds}`);
        callbacks.onSeek(seconds);
      },
      setRate: (_rate: number) => {},
      setVolume: (vol: number) => {
        postToIframe({ command: 'volume', value: vol / 100 });
      },
      setMuted: (muted: boolean) => {
        postToIframe({ command: muted ? 'mute' : 'unmute' });
      },
      getCurrentTime: () => currentTime,
      getDuration: () => 0,
      getCapabilities: (): PlaybackCapabilities => ({
        canSeek: false,
        canPause: true,
        canSyncRate: false,
        isLive: false,
      }),
      destroy: () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (iframeRef.current) iframeRef.current.src = 'about:blank';
      },
    }));

    useEffect(() => {
      callbacks.onReady();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (isPlaying) {
          setCurrentTime((prev) => {
            const next = prev + 0.5;
            callbacks.onTimeUpdate(next, 0);
            return next;
          });
        }
      }, 500);

      // Frame load timeout detector (in case site sends X-Frame-Options)
      const errorTimeout = setTimeout(() => {
        // If iframe didn't load or is blocked
      }, 5000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearTimeout(errorTimeout);
      };
    }, [isPlaying, callbacks]);

    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="Generic Web Video Player"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className="w-full h-full border-0 bg-black"
          onLoad={() => callbacks.onReady()}
          onError={() => setHasFrameError(true)}
        />

        {hasFrameError && (
          <div className="absolute inset-0 z-30 bg-dark-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <h4 className="text-base font-semibold text-white mb-1">
              Website Restricts Direct Framing
            </h4>
            <p className="text-xs text-gray-300 max-w-md mb-4">
              This webpage enforces security policies that prevent direct iframe embedding. You can still watch it together in an external window with synchronized session status.
            </p>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/30 transition-all hover:scale-105"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in External Watch Window</span>
            </a>
          </div>
        )}
      </div>
    );
  }
);
GenericEmbedAdapter.displayName = 'GenericEmbedAdapter';
