import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Crown,
  ChevronDown,
  ChevronUp,
  Users,
  Radio,
  Volume2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Participant } from '../types';

export type CallMode = 'audio' | 'video';

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  isHost?: boolean;
  isMe?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isSpeaking?: boolean;
  color?: string;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isHost,
  isMe,
  isMuted,
  isCameraOff,
  isSpeaking,
  color,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative aspect-video w-44 sm:w-52 bg-black/60 rounded-xl overflow-hidden border flex items-center justify-center flex-shrink-0 transition-all ${
        isSpeaking
          ? 'border-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
          : 'border-white/[0.08]'
      }`}
    >
      {/* Video Stream Element */}
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMe}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Camera Off Fallback */
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14]">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-xs text-white shadow-sm mb-1 transition-transform ${
              isSpeaking ? 'scale-105 ring-1 ring-emerald-400' : ''
            }`}
            style={{ backgroundColor: color || '#6366f1' }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-white/40">Camera off</span>
        </div>
      )}

      {/* Top Indicators */}
      <div className="absolute top-2 left-2 flex items-center gap-1 z-10 pointer-events-none">
        {isHost && (
          <span className="p-1 rounded-md bg-black/50 text-white/80 border border-white/[0.08]" title="Host">
            <Crown className="w-2.5 h-2.5" />
          </span>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10 pointer-events-none">
        {isMuted ? (
          <span className="p-1 rounded-md bg-rose-500/80 text-white" title="Muted">
            <MicOff className="w-2.5 h-2.5" />
          </span>
        ) : isSpeaking ? (
          <span className="p-1 rounded-md bg-emerald-500/80 text-white" title="Speaking">
            <Volume2 className="w-2.5 h-2.5" />
          </span>
        ) : null}
      </div>

      {/* Name Label */}
      <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between text-[10px] font-medium text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md pointer-events-none truncate z-10 border border-white/[0.06]">
        <span className="truncate">
          {name} {isMe && '(You)'}
        </span>
      </div>
    </div>
  );
};

interface AudioParticipantCardProps {
  name: string;
  isHost?: boolean;
  isMe?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  color?: string;
}

const AudioParticipantCard: React.FC<AudioParticipantCardProps> = ({
  name,
  isHost,
  isMe,
  isMuted,
  isSpeaking,
  color,
}) => {
  return (
    <div
      className={`relative px-3 py-2 rounded-xl border flex items-center gap-2.5 min-w-[130px] max-w-[180px] flex-shrink-0 transition-all ${
        isSpeaking
          ? 'bg-emerald-500/[0.08] border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
          : 'bg-white/[0.03] border-white/[0.06]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-[11px] text-white shadow-sm transition-transform ${
            isSpeaking ? 'scale-105 ring-1 ring-emerald-400' : ''
          }`}
          style={{ backgroundColor: color || '#6366f1' }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {isSpeaking && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/90 truncate">
          {name} {isMe && <span className="text-[10px] text-white/40 font-normal">(You)</span>}
        </p>
        <p className="text-[10px] text-white/40 flex items-center gap-1">
          {isMuted ? (
            <span className="text-rose-400 flex items-center gap-0.5">
              <MicOff className="w-2.5 h-2.5" /> Muted
            </span>
          ) : isSpeaking ? (
            <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
              <Volume2 className="w-2.5 h-2.5" /> Speaking
            </span>
          ) : (
            <span>Active</span>
          )}
        </p>
      </div>
    </div>
  );
};

export interface VideoCallGridProps {
  isCallActive: boolean;
  callMode: CallMode | null;
  isInCall: boolean;
  isConnecting?: boolean;
  callError?: string | null;
  isHost: boolean;
  hostName: string;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  speakingParticipants?: Set<string>;
  isMicMuted: boolean;
  isCameraOff: boolean;
  participants: Participant[];
  currentUserId: string;
  onJoinCall: (mode?: CallMode) => void;
  onLeaveCall: () => void;
  onStartCall: (mode: CallMode) => void;
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export const VideoCallGrid: React.FC<VideoCallGridProps> = ({
  isCallActive,
  callMode,
  isInCall,
  isConnecting,
  callError,
  isHost,
  hostName,
  localStream,
  remoteStreams,
  speakingParticipants = new Set(),
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
  const [minimized, setMinimized] = useState(false);

  // 1. If call is NOT active
  if (!isCallActive) {
    if (isHost) {
      return (
        <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/70 flex items-center justify-center flex-shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/90">Group Calling</p>
              <p className="text-[11px] text-white/40">
                Start audio or video calling to watch and talk together in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartCall('audio')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/80 hover:text-white border border-white/[0.08] text-xs font-medium transition-all"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio Call</span>
            </button>
            <button
              onClick={() => onStartCall('video')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-medium transition-all"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Call</span>
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  // 2. If call IS active but this participant has NOT joined yet
  if (!isInCall) {
    const isAudioMode = callMode === 'audio';

    return (
      <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-white/90">
              {hostName} started a group {isAudioMode ? 'audio' : 'video'} call
            </p>
            <p className="text-[11px] text-white/40">
              {isAudioMode ? 'Join with your microphone to talk together.' : 'Join the call to share your camera and watch together.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onJoinCall(callMode || 'video')}
          disabled={isConnecting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium transition-all flex-shrink-0 disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : isAudioMode ? (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Join Audio</span>
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              <span>Join Video</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // 3. User IS inside active call
  const isAudioMode = callMode === 'audio';
  const currentParticipant = participants.find((p) => p.id === currentUserId);
  const meName = currentParticipant?.name || 'You';
  const totalCallers = 1 + remoteStreams.size;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl">
      {/* Error Notice */}
      {callError && (
        <div className="mb-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
          <span className="flex-1">{callError}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs text-white/80">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-white">
            Group {isAudioMode ? 'Audio' : 'Video'} Call
          </span>
          <span className="text-white/40">•</span>
          <span className="text-[11px] text-white/50">{totalCallers} in call</span>
        </div>

        <button
          onClick={() => setMinimized(!minimized)}
          className="p-1 text-white/40 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors"
          title={minimized ? 'Expand' : 'Collapse'}
        >
          {minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Call Content Area */}
      {!minimized && (
        <div className="mb-3">
          {isAudioMode ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <AudioParticipantCard
                name={meName}
                isHost={isHost}
                isMe={true}
                isMuted={isMicMuted}
                isSpeaking={speakingParticipants.has(currentUserId)}
                color={currentParticipant?.color}
              />

              {Array.from(remoteStreams.entries()).map(([pId]) => {
                const peer = participants.find((p) => p.id === pId);
                return (
                  <AudioParticipantCard
                    key={pId}
                    name={peer?.name || 'Guest'}
                    isHost={peer?.role === 'host'}
                    isMe={false}
                    isMuted={false}
                    isSpeaking={speakingParticipants.has(pId)}
                    color={peer?.color}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              <VideoTile
                stream={localStream}
                name={meName}
                isHost={isHost}
                isMe={true}
                isMuted={isMicMuted}
                isCameraOff={isCameraOff}
                isSpeaking={speakingParticipants.has(currentUserId)}
                color={currentParticipant?.color}
              />

              {Array.from(remoteStreams.entries()).map(([pId, rStream]) => {
                const peer = participants.find((p) => p.id === pId);
                return (
                  <VideoTile
                    key={pId}
                    stream={rStream}
                    name={peer?.name || 'Guest'}
                    isHost={peer?.role === 'host'}
                    isMe={false}
                    isMuted={false}
                    isCameraOff={false}
                    isSpeaking={speakingParticipants.has(pId)}
                    color={peer?.color}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Control Actions Row */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isMicMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/90 border border-white/[0.08]'
          }`}
          title={isMicMuted ? 'Unmute' : 'Mute'}
        >
          {isMicMuted ? (
            <>
              <MicOff className="w-3.5 h-3.5" />
              <span>Unmute</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Mute</span>
            </>
          )}
        </button>

        {/* Camera Toggle (Video Mode Only) */}
        {!isAudioMode && (
          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isCameraOff
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/90 border border-white/[0.08]'
            }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? (
              <>
                <VideoOff className="w-3.5 h-3.5" />
                <span>Camera On</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Camera Off</span>
              </>
            )}
          </button>
        )}

        {/* End or Leave Call */}
        {isHost ? (
          <button
            onClick={onEndCall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white font-medium text-xs shadow-sm transition-all"
            title="End group call for everyone"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        ) : (
          <button
            onClick={onLeaveCall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white font-medium text-xs shadow-sm transition-all"
            title="Leave this call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoCallGrid;
