import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  RefreshCw,
  AlertTriangle,
  Radio,
  Users,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useP2PVideoStream, P2PStreamStats } from '../hooks/useP2PVideoStream';
import { Participant } from '../types';

export interface P2PLocalVideoPlayerProps {
  roomId: string;
  isHost: boolean;
  hostId: string;
  hostName: string;
  myParticipantId: string;
  participants: Participant[];
  initialBlobUrl?: string;
  initialFileName?: string;
  emitSignal: (targetParticipantId: string, signal: any) => void;
  emitState: (state: any) => void;
  onIncomingSignalRef?: React.MutableRefObject<((senderId: string, payload: any) => void) | null>;
  onIncomingStateRef?: React.MutableRefObject<((senderId: string, state: any) => void) | null>;
  onStopSharing?: () => void;
}

export const P2PLocalVideoPlayer: React.FC<P2PLocalVideoPlayerProps> = ({
  roomId,
  isHost,
  hostId,
  hostName,
  myParticipantId,
  participants,
  initialBlobUrl = '',
  initialFileName = '',
  emitSignal,
  emitState,
  onIncomingSignalRef,
  onIncomingStateRef,
  onStopSharing,
}) => {
  // Video element references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Local file state (Host only)
  const [localBlobUrl, setLocalBlobUrl] = useState<string>(initialBlobUrl);
  const [localFileName, setLocalFileName] = useState<string>(initialFileName);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState<boolean>(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // P2P WebRTC connection hook
  const {
    connectionState,
    errorMessage,
    remoteStream,
    stats,
    isRoomCapacityExceeded,
    activeViewer,
    hostPlaybackEvent,
    handleSignal,
    handleState,
    broadcastPlaybackState,
    reconnect,
    cleanup,
  } = useP2PVideoStream({
    roomId,
    isHost,
    hostId,
    myParticipantId,
    participants,
    localStream,
    emitSignal,
    emitState,
  });

  // Attach incoming signal and state router handlers to refs
  useEffect(() => {
    if (onIncomingSignalRef) {
      onIncomingSignalRef.current = handleSignal;
    }
    if (onIncomingStateRef) {
      onIncomingStateRef.current = handleState;
    }
    return () => {
      if (onIncomingSignalRef) onIncomingSignalRef.current = null;
      if (onIncomingStateRef) onIncomingStateRef.current = null;
    };
  }, [handleSignal, handleState, onIncomingSignalRef, onIncomingStateRef]);

  // Host: Capture video and audio stream from <video> element via captureStream()
  const captureLocalStream = useCallback(() => {
    const video = localVideoRef.current;
    if (!video) return null;

    try {
      let stream: MediaStream | null = null;
      if (typeof (video as any).captureStream === 'function') {
        stream = (video as any).captureStream();
      } else if (typeof (video as any).mozCaptureStream === 'function') {
        stream = (video as any).mozCaptureStream();
      }

      if (stream) {
        setLocalStream(stream);
        return stream;
      }
    } catch (err) {
      console.warn('[P2P Local Video] captureStream not supported or blocked by browser:', err);
    }
    return null;
  }, []);

  // Host: Load local file into Object URL
  const handleSelectFile = useCallback((file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalBlobUrl(url);
    setLocalFileName(file.name);
  }, []);

  // Host: Setup capture on video play/ready
  useEffect(() => {
    if (!isHost || !localBlobUrl) return;
    const video = localVideoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      captureLocalStream();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleLoadedMetadata);
    };
  }, [isHost, localBlobUrl, captureLocalStream]);

  // Viewer: Attach remote WebRTC MediaStream to <video>
  useEffect(() => {
    if (isHost || !remoteStream) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    if (video.srcObject !== remoteStream) {
      video.srcObject = remoteStream;
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsAutoplayMuted(false);
        })
        .catch(() => {
          // Fallback for browser autoplay policies
          video.muted = true;
          setIsMuted(true);
          setIsAutoplayMuted(true);
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
    }
  }, [isHost, remoteStream]);

  // Viewer: Synchronize with Authoritative Host Playback Events
  useEffect(() => {
    if (isHost || !hostPlaybackEvent) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    const { action, position } = hostPlaybackEvent;

    switch (action) {
      case 'PLAY':
      case 'STREAM_STARTED':
        video.play().catch(() => {});
        setIsPlaying(true);
        if (Math.abs(video.currentTime - position) > 1.2) {
          video.currentTime = position;
        }
        break;
      case 'PAUSE':
        video.pause();
        setIsPlaying(false);
        if (Math.abs(video.currentTime - position) > 0.8) {
          video.currentTime = position;
        }
        break;
      case 'SEEK':
        video.currentTime = position;
        break;
      case 'STREAM_STOPPED':
        video.pause();
        setIsPlaying(false);
        break;
    }
  }, [isHost, hostPlaybackEvent]);

  // Host: Play/Pause toggler
  const togglePlayPause = () => {
    if (!isHost) return;
    const video = localVideoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        broadcastPlaybackState('PLAY', video.currentTime);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      broadcastPlaybackState('PAUSE', video.currentTime);
    }
  };

  // Host: Scrubber seek
  const handleSeek = (seconds: number) => {
    if (!isHost) return;
    const video = localVideoRef.current;
    if (!video) return;

    video.currentTime = seconds;
    setCurrentTime(seconds);
    broadcastPlaybackState('SEEK', seconds);
  };

  // Stop sharing local video & clean up tracks
  const handleStopSharing = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
      setLocalBlobUrl('');
      setLocalFileName('');
    }
    cleanup();
    broadcastPlaybackState('STREAM_STOPPED', 0);
    onStopSharing?.();
  };

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // UI Control auto-hide
  const triggerControlActivity = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerControlActivity}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden select-none group flex items-center justify-center"
    >
      {/* 1. ROOM CAPACITY LIMIT OVERLAY (3rd+ participant blocked from P2P stream) */}
      {isRoomCapacityExceeded && (
        <div className="absolute inset-0 z-40 bg-[#07080a]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">1-on-1 Local P2P Streaming</h3>
          <p className="text-xs text-white/60 max-w-sm mb-4 leading-relaxed">
            This room is currently in private 1-on-1 browser-to-browser P2P streaming mode between{' '}
            <span className="text-white font-medium">{hostName}</span> and their first guest. Local P2P streaming does not use media servers and is limited to exactly two participants.
          </p>
          <div className="text-[11px] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50">
            Room chat and reactions remain available for all members.
          </div>
        </div>
      )}

      {/* 2. DIRECT CONNECTION UNAVAILABLE ERROR OVERLAY (NAT traversal failure without TURN) */}
      {errorMessage && (
        <div className="absolute inset-0 z-40 bg-[#07080a]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-2">Connection Failed</h3>
          <p className="text-xs text-rose-300/90 max-w-md mb-6 leading-relaxed bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl font-mono text-[11px]">
            {errorMessage}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={reconnect}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 hover:bg-white/90 transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Direct Connection</span>
            </button>
            {isHost && (
              <button
                onClick={handleStopSharing}
                className="px-4 py-2 rounded-xl bg-white/[0.08] text-white hover:bg-white/[0.12] text-xs font-medium transition-all cursor-pointer"
              >
                Change Video Source
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. HOST: NO VIDEO SELECTED STATE */}
      {isHost && !localBlobUrl && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-[#07080a]">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">Share Local Video (Zero Server Cost)</h3>
          <p className="text-xs text-white/50 max-w-md mb-6 leading-relaxed">
            Select an MP4 or WebM video file from your computer. The video streams directly from your browser to your friend via encrypted WebRTC with zero server storage.
          </p>
          <label className="px-5 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-xs tracking-tight cursor-pointer shadow-xl transition-all flex items-center gap-2.5">
            <Upload className="w-4 h-4" />
            <span>Choose Video File</span>
            <input
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectFile(file);
              }}
            />
          </label>
        </div>
      )}

      {/* 4. HOST VIDEO ELEMENT */}
      {isHost && localBlobUrl && (
        <video
          ref={localVideoRef}
          src={localBlobUrl}
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlayPause}
          onTimeUpdate={() => {
            const v = localVideoRef.current;
            if (v) setCurrentTime(v.currentTime);
          }}
          onEnded={() => {
            setIsPlaying(false);
            broadcastPlaybackState('PAUSE', duration);
          }}
        />
      )}

      {/* 5. VIEWER VIDEO ELEMENT */}
      {!isHost && (
        <video
          ref={remoteVideoRef}
          playsInline
          autoPlay
          className="w-full h-full object-contain cursor-pointer"
          onTimeUpdate={() => {
            const v = remoteVideoRef.current;
            if (v) setCurrentTime(v.currentTime);
          }}
        />
      )}

      {/* 6. VIEWER: WAITING FOR HOST / CONNECTING BANNER */}
      {!isHost && !remoteStream && !errorMessage && !isRoomCapacityExceeded && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#07080a]/90">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1.5">
            {connectionState === 'connecting' ? 'Connecting directly...' : 'Waiting for host video stream'}
          </h3>
          <p className="text-xs text-white/50 max-w-sm">
            {connectionState === 'connecting'
              ? 'Establishing direct peer-to-peer WebRTC connection with host...'
              : `${hostName} is preparing a local video stream.`}
          </p>
        </div>
      )}

      {/* 7. AUTOPLAY UNMUTE OVERLAY FOR VIEWER */}
      {isAutoplayMuted && (
        <div className="absolute top-4 left-4 z-30">
          <button
            onClick={() => {
              const v = remoteVideoRef.current;
              if (v) {
                v.muted = false;
                setIsMuted(false);
                setIsAutoplayMuted(false);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg animate-bounce"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Click to Unmute Audio</span>
          </button>
        </div>
      )}

      {/* 8. TOP STATUS BAR: CONNECTION STATUS & BITRATE METRICS */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Connection State Badge */}
        <div className="flex items-center gap-2">
          {connectionState === 'waiting_for_friend' && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Waiting for your friend</span>
            </span>
          )}

          {connectionState === 'connecting' && (
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-md">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Connecting directly</span>
            </span>
          )}

          {connectionState === 'connected' && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-md">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Connected (Direct P2P)</span>
            </span>
          )}

          {/* Local file title */}
          {localFileName && (
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-white/70 text-[11px] max-w-[200px] truncate backdrop-blur-md">
              {localFileName}
            </span>
          )}
        </div>

        {/* Right: Live Quality & Bitrate Diagnostics */}
        {connectionState === 'connected' && (
          <div className="flex items-center gap-2 text-[10px] text-white/60 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <Activity className="w-3 h-3 text-emerald-400" />
            {stats.bitrateKbps > 0 && <span>{stats.bitrateKbps} kbps</span>}
            {stats.roundTripTimeMs > 0 && <span>• {stats.roundTripTimeMs}ms RTT</span>}
            <span className="capitalize">• {stats.connectionQuality}</span>
          </div>
        )}
      </div>

      {/* 9. BOTTOM MEDIA CONTROLS (Host is Authoritative Controller) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div className="relative mb-3 flex items-center group/scrubber">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            disabled={!isHost}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className={`w-full h-1 bg-white/20 rounded-lg appearance-none outline-none accent-indigo-500 transition-all ${
              isHost ? 'cursor-pointer hover:h-2' : 'cursor-default'
            }`}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button (Host Only) */}
            {isHost ? (
              <button
                onClick={togglePlayPause}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.08] text-white/60 text-xs">
                {isPlaying ? <Play className="w-3 h-3 text-emerald-400 fill-current" /> : <Pause className="w-3 h-3" />}
                <span>Host Control</span>
              </div>
            )}

            {/* Time Indicator */}
            <div className="text-xs text-white/60 font-mono">
              <span>{formatTime(currentTime)}</span>
              {duration > 0 && <span> / {formatTime(duration)}</span>}
            </div>

            {/* Volume & Mute */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => {
                  const targetVideo = isHost ? localVideoRef.current : remoteVideoRef.current;
                  if (targetVideo) {
                    const newMuted = !targetVideo.muted;
                    targetVideo.muted = newMuted;
                    setIsMuted(newMuted);
                  }
                }}
                className="p-1 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setVolume(val);
                  setIsMuted(val === 0);
                  const targetVideo = isHost ? localVideoRef.current : remoteVideoRef.current;
                  if (targetVideo) {
                    targetVideo.volume = val / 100;
                    targetVideo.muted = val === 0;
                  }
                }}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none accent-white cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Host Stop Sharing Action */}
            {isHost && (
              <button
                onClick={handleStopSharing}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
              >
                Stop Sharing
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default P2PLocalVideoPlayer;
