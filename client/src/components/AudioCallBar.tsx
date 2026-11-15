import React from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Crown,
  Volume2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Radio,
  Wifi,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioParticipantInfo } from '../webrtc/AudioRoomManager';

interface AudioCallBarProps {
  isCallActive: boolean;
  isInCall: boolean;
  isConnecting: boolean;
  isMicMuted: boolean;
  callError: string | null;
  isHost: boolean;
  participants: AudioParticipantInfo[];
  speakingParticipants: Set<string>;
  onStartCall: () => void;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onEndCall: () => void;
  onToggleMic: () => void;
  onRetry: () => void;
  onClearError: () => void;
}

export const AudioCallBar: React.FC<AudioCallBarProps> = ({
  isCallActive,
  isInCall,
  isConnecting,
  isMicMuted,
  callError,
  isHost,
  participants,
  speakingParticipants,
  onStartCall,
  onJoinCall,
  onLeaveCall,
  onEndCall,
  onToggleMic,
  onRetry,
  onClearError,
}) => {
  const participantCount = participants.length;
  const isFull = participantCount >= 5;

  return (
    <div className="w-full bg-[#0B0F17]/95 border border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-xl transition-all">
      {/* Top Status & Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">
                Direct Mesh Voice
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                P2P • STUN Only
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  isFull
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-white/[0.06] text-white/70 border-white/[0.08]'
                }`}
              >
                {participantCount}/5 Participants
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* If call not active: Host can start, guest sees status */}
          {!isCallActive && !isInCall && (
            <>
              {isHost ? (
                <button
                  onClick={onStartCall}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>Start Voice Call</span>
                </button>
              ) : (
                <span className="text-xs text-white/50 italic py-1">Voice call offline</span>
              )}
            </>
          )}

          {/* If call active but user is NOT in call */}
          {isCallActive && !isInCall && (
            <button
              onClick={onJoinCall}
              disabled={isConnecting || isFull}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-white font-medium text-xs transition-all active:scale-95 shadow-lg ${
                isFull
                  ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
              }`}
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span>{isFull ? 'Call Full (5/5)' : 'Join Voice Call'}</span>
            </button>
          )}

          {/* If user IS in call */}
          {isInCall && (
            <div className="flex items-center gap-1.5">
              {/* Mic Toggle Button */}
              <button
                onClick={onToggleMic}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isMicMuted
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-white/10 border border-white/15 text-white hover:bg-white/15'
                }`}
              >
                {isMicMuted ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mute</span>
                  </>
                )}
              </button>

              {/* Leave Call */}
              <button
                onClick={onLeaveCall}
                title="Leave Voice Call"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-medium transition-all"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leave</span>
              </button>

              {/* End Call for All (Host only) */}
              {isHost && (
                <button
                  onClick={onEndCall}
                  title="End Voice Call for Everyone"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
                >
                  <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">End for All</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Alert Display */}
      <AnimatePresence>
        {callError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-3 text-xs text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{callError}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-all text-[11px]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
              <button
                onClick={onClearError}
                className="text-white/40 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participants Avatar Mesh Dock */}
      {isInCall && participants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {participants.map((p) => {
            const isSpeaking = speakingParticipants.has(p.id) || p.isSpeaking;
            const isConnected = p.isLocal || p.connectionState === 'connected';
            const isFailed = p.connectionState === 'failed';

            return (
              <div
                key={p.id}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                  isSpeaking
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                    : 'bg-white/[0.04] border-white/[0.08]'
                }`}
              >
                {/* Avatar with speaking ring */}
                <div className="relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase transition-all ${
                      p.isLocal
                        ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'
                        : 'bg-white/10 text-white/90 border border-white/10'
                    } ${
                      isSpeaking
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0B0F17]'
                        : ''
                    }`}
                  >
                    {p.name.charAt(0)}
                  </div>

                  {/* Host Crown */}
                  {p.isHost && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                      <Crown className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {/* Muted Badge */}
                  {p.isMuted && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md">
                      <MicOff className="w-2 h-2" />
                    </div>
                  )}
                </div>

                {/* Participant Details */}
                <div className="flex flex-col min-w-[70px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate max-w-[90px]">
                      {p.name} {p.isLocal ? '(You)' : ''}
                    </span>
                  </div>

                  {/* Network / Connection Subtext */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {p.isLocal ? (
                      <span className="text-white/40">Local Mic</span>
                    ) : isConnected ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>
                          {p.stats?.candidateType === 'host' ? 'LAN' : 'STUN P2P'}
                          {p.stats?.roundTripTimeMs ? ` • ${p.stats.roundTripTimeMs}ms` : ''}
                        </span>
                      </span>
                    ) : isFailed ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>Failed</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Connecting</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
