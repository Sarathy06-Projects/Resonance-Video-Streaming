import React, { useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Crown,
  Maximize2,
  Minimize2,
  Users,
} from 'lucide-react';
import { Participant } from '../types';

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  isHost?: boolean;
  isMe?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  color?: string;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isHost,
  isMe,
  isMuted,
  isCameraOff,
  color,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video sm:w-48 sm:h-32 bg-dark-950 rounded-xl overflow-hidden border border-dark-700/80 shadow-md flex items-center justify-center group flex-shrink-0">
      {/* Video Stream Element */}
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMe} // Mute self to prevent feedback
          className="w-full h-full object-cover"
        />
      ) : (
        /* Camera Off Avatar Fallback */
        <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md mb-1"
            style={{ backgroundColor: color || '#6366f1' }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-gray-400">Camera Off</span>
        </div>
      )}

      {/* Badges Overlay */}
      <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
        {isHost && (
          <span className="p-1 rounded-md bg-amber-500/80 text-white" title="Room Creator">
            <Crown className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10">
        {isMuted ? (
          <span className="p-1 rounded-md bg-red-500/80 text-white" title="Muted">
            <MicOff className="w-3 h-3" />
          </span>
        ) : (
          <span className="p-1 rounded-md bg-emerald-500/80 text-white" title="Microphone Active">
            <Mic className="w-3 h-3" />
          </span>
        )}
      </div>

      {/* Name Label */}
      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[11px] font-medium text-white/90 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md pointer-events-none truncate z-10">
        <span className="truncate">
          {name} {isMe && '(You)'}
        </span>
      </div>
    </div>
  );
};

interface VideoCallGridProps {
  isCallActive: boolean;
  isInCall: boolean;
  isHost: boolean;
  hostName: string;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  mediaStates: Map<string, { isMuted: boolean; isCameraOff: boolean }>;
  isMicMuted: boolean;
  isCameraOff: boolean;
  participants: Participant[];
  currentUserId: string;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export const VideoCallGrid: React.FC<VideoCallGridProps> = ({
  isCallActive,
  isInCall,
  isHost,
  hostName,
  localStream,
  remoteStreams,
  mediaStates,
  isMicMuted,
  isCameraOff,
  participants,
  currentUserId,
  onJoinCall,
  onLeaveCall,
  onStartCall,
  onEndCall,
  onToggleMic,
  onToggleCamera,
}) => {
  const [minimized, setMinimized] = React.useState(false);

  // If call is not active
  if (!isCallActive) {
    if (isHost) {
      return (
        <div className="mt-3 p-3 rounded-xl bg-dark-900/70 border border-dark-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Group Video Call</p>
              <p className="text-[11px] text-gray-400">See each other's faces while watching together</p>
            </div>
          </div>
          <button
            onClick={onStartCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Start Group Call</span>
          </button>
        </div>
      );
    }
    // For viewers when no call has been started
    return null;
  }

  // If call is active but this viewer has not joined yet
  if (!isInCall) {
    return (
      <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-dark-900 border border-emerald-500/40 flex items-center justify-between animate-pulse-subtle shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{hostName} started a Group Video Call!</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                Live
              </span>
            </p>
            <p className="text-[11px] text-gray-300 mt-0.5">
              Join the call to share your face and watch together.
            </p>
          </div>
        </div>
        <button
          onClick={onJoinCall}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 flex-shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Join Call</span>
        </button>
      </div>
    );
  }

  // Inside Active Call: render video tile strip / grid
  const currentParticipant = participants.find((p) => p.id === currentUserId);
  const meName = currentParticipant?.name || 'You';

  return (
    <div className="mt-3 p-3 rounded-2xl bg-dark-900/90 border border-dark-700/80 shadow-2xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-white">Live Group Video Call</span>
          <span className="text-[10px] text-gray-400 bg-dark-800 px-2 py-0.5 rounded-full">
            {1 + remoteStreams.size} connected
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            title={minimized ? 'Expand cameras' : 'Minimize cameras'}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {/* My Video Tile */}
          <VideoTile
            stream={localStream}
            name={meName}
            isHost={isHost}
            isMe={true}
            isMuted={isMicMuted}
            isCameraOff={isCameraOff}
            color={currentParticipant?.color}
          />

          {/* Remote Peer Video Tiles */}
          {Array.from(remoteStreams.entries()).map(([pId, rStream]) => {
            const peer = participants.find((p) => p.id === pId);
            const peerState = mediaStates.get(pId);
            return (
              <VideoTile
                key={pId}
                stream={rStream}
                name={peer?.name || 'Guest'}
                isHost={peer?.role === 'host'}
                isMe={false}
                isMuted={peerState?.isMuted}
                isCameraOff={peerState?.isCameraOff}
                color={peer?.color}
              />
            );
          })}
        </div>
      )}

      {/* Floating Call Action Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-2.5 rounded-full text-white transition-all active:scale-95 shadow-md ${
            isMicMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-dark-800 hover:bg-dark-700 border border-dark-600'
          }`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-2.5 rounded-full text-white transition-all active:scale-95 shadow-md ${
            isCameraOff ? 'bg-red-600 hover:bg-red-500' : 'bg-dark-800 hover:bg-dark-700 border border-dark-600'
          }`}
          title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* End / Leave Button */}
        {isHost ? (
          <button
            onClick={onEndCall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
            title="End group call for everyone"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call (All)</span>
          </button>
        ) : (
          <button
            onClick={onLeaveCall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
            title="Leave group call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave Call</span>
          </button>
        )}
      </div>
    </div>
  );
};
