import React, { useRef, useEffect, useState } from 'react';
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
  Radio,
  Volume2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
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
      className={`relative aspect-video w-44 sm:w-52 h-28 sm:h-32 bg-dark-950 rounded-xl overflow-hidden border shadow-md flex items-center justify-center group flex-shrink-0 transition-all ${
        isSpeaking ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-dark-700/80'
      }`}
    >
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
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md mb-1 transition-transform ${
              isSpeaking ? 'scale-110 ring-2 ring-emerald-400' : ''
            }`}
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
          <span className="p-1 rounded-md bg-amber-500/90 text-white" title="Room Creator">
            <Crown className="w-3 h-3" />
          </span>
        )}
        {isSpeaking && (
          <span className="p-1 rounded-md bg-emerald-500/90 text-white animate-pulse" title="Speaking">
            <Volume2 className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10">
        {isMuted ? (
          <span className="p-1 rounded-md bg-red-500/90 text-white" title="Muted">
            <MicOff className="w-3 h-3" />
          </span>
        ) : (
          <span className="p-1 rounded-md bg-emerald-500/90 text-white" title="Microphone Active">
            <Mic className="w-3 h-3" />
          </span>
        )}
      </div>

      {/* Name Label */}
      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[11px] font-medium text-white/90 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md pointer-events-none truncate z-10">
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
      className={`relative px-3 py-2.5 rounded-xl bg-dark-950 border flex items-center gap-2.5 min-w-[140px] max-w-[200px] flex-shrink-0 transition-all ${
        isSpeaking
          ? 'border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400'
          : 'border-dark-750 bg-dark-900/80'
      }`}
    >
      {/* Avatar with speaking wave pulse */}
      <div className="relative">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-md transition-all ${
            isSpeaking ? 'ring-2 ring-emerald-400 animate-pulse-subtle scale-105' : ''
          }`}
          style={{ backgroundColor: color || '#6366f1' }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {isHost && (
          <span className="absolute -top-1 -left-1 p-0.5 rounded-full bg-amber-500 text-white shadow">
            <Crown className="w-2.5 h-2.5" />
          </span>
        )}
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-dark-950 animate-ping" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">
          {name} {isMe && <span className="text-[10px] text-gray-400 font-normal">(You)</span>}
        </p>
        <p className="text-[10px] flex items-center gap-1 text-gray-400">
          {isMuted ? (
            <span className="text-red-400 flex items-center gap-0.5">
              <MicOff className="w-2.5 h-2.5" /> Muted
            </span>
          ) : isSpeaking ? (
            <span className="text-emerald-400 flex items-center gap-0.5 font-medium animate-pulse">
              <Volume2 className="w-2.5 h-2.5" /> Speaking
            </span>
          ) : (
            <span className="text-gray-400 flex items-center gap-0.5">
              <Mic className="w-2.5 h-2.5 text-emerald-400" /> Active
            </span>
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
        <div className="mt-3 p-3.5 rounded-xl bg-dark-900/90 border border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Start Group Calling</p>
              <p className="text-[11px] text-gray-400">
                Choose audio-only or video calling to watch and talk together in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Start Audio Call (First-Class calling option) */}
            <button
              onClick={() => onStartCall('audio')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              title="Start audio-only voice call (Microphone only, no camera required)"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Start Audio Call</span>
            </button>

            {/* Start Video Call */}
            <button
              onClick={() => onStartCall('video')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
              title="Start group video call with face cameras and audio"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Start Video Call</span>
            </button>
          </div>
        </div>
      );
    }
    // Viewers see nothing when host hasn't started a call
    return null;
  }

  // 2. If call IS active but this participant has NOT joined yet
  if (!isInCall) {
    const isAudioMode = callMode === 'audio';

    return (
      <div
        className={`mt-3 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl transition-all ${
          isAudioMode
            ? 'bg-gradient-to-r from-indigo-950/60 to-dark-900 border-indigo-500/40'
            : 'bg-gradient-to-r from-emerald-950/60 to-dark-900 border-emerald-500/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isAudioMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {isAudioMode ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : (
              <Video className="w-5 h-5 animate-bounce" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>
                {hostName} started a Group {isAudioMode ? 'Audio' : 'Video'} Call!
              </span>
              <span
                className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                  isAudioMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                Live
              </span>
            </p>
            <p className="text-[11px] text-gray-300 mt-0.5">
              {isAudioMode
                ? 'Join with your microphone to talk together while the video plays.'
                : 'Join the video call to share your camera and watch together.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onJoinCall(callMode || 'video')}
          disabled={isConnecting}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-medium text-xs shadow-lg transition-all hover:scale-105 active:scale-95 flex-shrink-0 disabled:opacity-60 ${
            isAudioMode
              ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30'
          }`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : isAudioMode ? (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Join Audio Call</span>
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              <span>Join Video Call</span>
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
    <div className="mt-3 p-3 rounded-2xl bg-dark-900/95 border border-dark-750 shadow-2xl backdrop-blur-md">
      {/* Permission / Connection Error Notice */}
      {callError && (
        <div className="mb-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span className="flex-1">{callError}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isAudioMode ? 'bg-indigo-500' : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-bold text-white">
            Live Group {isAudioMode ? 'Audio' : 'Video'} Call
          </span>
          <span className="text-[10px] text-gray-400 bg-dark-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {totalCallers} connected
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            title={minimized ? 'Expand call grid' : 'Minimize call grid'}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Call Content Area */}
      {!minimized && (
        <>
          {isAudioMode ? (
            /* Audio Calling Mode: Avatar voice cards with speaking indicators */
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {/* My Audio Card */}
              <AudioParticipantCard
                name={meName}
                isHost={isHost}
                isMe={true}
                isMuted={isMicMuted}
                isSpeaking={speakingParticipants.has(currentUserId)}
                color={currentParticipant?.color}
              />

              {/* Remote Participant Audio Cards */}
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
            /* Video Calling Mode: Camera video tiles */
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {/* My Video Tile */}
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

              {/* Remote Peer Video Tiles */}
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
        </>
      )}

      {/* Action Controls Bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2">
        {/* Mic Toggle (Present in both Audio and Video modes) */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-medium transition-all active:scale-95 shadow-md ${
            isMicMuted
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-dark-800 hover:bg-dark-700 border border-dark-600'
          }`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMuted ? (
            <>
              <MicOff className="w-3.5 h-3.5" />
              <span>Unmute</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mute</span>
            </>
          )}
        </button>

        {/* Camera Toggle: ONLY rendered in Video Mode. Never shown in Audio-only mode */}
        {!isAudioMode && (
          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-medium transition-all active:scale-95 shadow-md ${
              isCameraOff
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-dark-800 hover:bg-dark-700 border border-dark-600'
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
                <Video className="w-3.5 h-3.5 text-emerald-400" />
                <span>Camera Off</span>
              </>
            )}
          </button>
        )}

        {/* End (Host) or Leave (Participant) */}
        {isHost ? (
          <button
            onClick={onEndCall}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
            title="End group call for everyone in the room"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call (All)</span>
          </button>
        ) : (
          <button
            onClick={onLeaveCall}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
            title="Leave this call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave Call</span>
          </button>
        )}
      </div>
    </div>
  );
};
