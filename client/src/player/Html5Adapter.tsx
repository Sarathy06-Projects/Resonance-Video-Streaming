import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import { PlayerAdapter, AdapterCallbacks, PlayerCapabilities } from './types';

interface Html5AdapterProps {
  url: string;
  format?: 'mp4' | 'webm' | 'hls' | 'dash' | 'direct';
  callbacks: AdapterCallbacks;
}

export const Html5Adapter = forwardRef<PlayerAdapter, Html5AdapterProps>(
  ({ url, format = 'mp4', callbacks }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);

    const isHls = format === 'hls' || url.toLowerCase().includes('.m3u8');
    const isDash = format === 'dash' || url.toLowerCase().includes('.mpd');

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (!videoRef.current) return;
        try {
          await videoRef.current.play();
        } catch (err: any) {
          // Autoplay policy blocked audio
          if (err.name === 'NotAllowedError') {
            videoRef.current.muted = true;
            await videoRef.current.play().catch(() => {});
          }
        }
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seekTo: (seconds: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = seconds;
      },
      setRate: (rate: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
      },
      setVolume: (vol: number) => {
        if (!videoRef.current) return;
        videoRef.current.volume = Math.max(0, Math.min(1, vol / 100));
      },
      setMuted: (muted: boolean) => {
        if (!videoRef.current) return;
        videoRef.current.muted = muted;
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        const d = videoRef.current?.duration;
        return typeof d === 'number' && !isNaN(d) && isFinite(d) ? d : 0;
      },
      getCapabilities: (): PlayerCapabilities => ({
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      }),
      destroy: () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (dashRef.current) {
          dashRef.current.reset();
          dashRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = '';
        }
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !url) return;

      // Clean up previous instances
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashRef.current) {
        dashRef.current.reset();
        dashRef.current = null;
      }

      if (isHls) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            callbacks.onReady();
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  callbacks.onError('HLS stream fatal playback error');
                  hls.destroy();
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari HLS
          video.src = url;
          callbacks.onReady();
        } else {
          callbacks.onError('HLS video playback is not supported on this browser');
        }
      } else if (isDash) {
        if (dashjs.supportsMediaSource()) {
          const dash = dashjs.MediaPlayer().create();
          dashRef.current = dash;
          dash.initialize(video, url, false);
          dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            callbacks.onReady();
          });
          dash.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
            callbacks.onError(e?.error?.message || 'DASH playback error');
          });
        } else {
          video.src = url;
          callbacks.onReady();
        }
      } else {
        // Direct MP4 / WebM
        video.src = url;
        video.load();
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (dashRef.current) {
          dashRef.current.reset();
          dashRef.current = null;
        }
      };
    }, [url, isHls, isDash]);

    return (
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className="w-full h-full object-contain bg-black"
        onCanPlay={() => callbacks.onReady()}
        onPlay={() => callbacks.onPlay(videoRef.current?.currentTime || 0)}
        onPause={() => callbacks.onPause(videoRef.current?.currentTime || 0)}
        onSeeked={() => callbacks.onSeek(videoRef.current?.currentTime || 0)}
        onTimeUpdate={() => {
          if (!videoRef.current) return;
          callbacks.onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration || 0);
        }}
        onEnded={() => callbacks.onEnded()}
        onWaiting={() => callbacks.onBuffering(true)}
        onPlaying={() => callbacks.onBuffering(false)}
        onError={(e) => {
          const mediaError = (e.target as HTMLVideoElement).error;
          callbacks.onError(mediaError?.message || 'HTML5 video playback error');
        }}
      />
    );
  }
);
Html5Adapter.displayName = 'Html5Adapter';
