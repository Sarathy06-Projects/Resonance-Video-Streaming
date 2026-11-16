import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Share2,
  Settings,
  Sparkles,
  MessageSquare,
  Users,
  ListPlus,
  Lock,
  ChevronLeft,
  Crown,
  Video,
  Copy,
  Check,
  Film,
  Radio,
  RotateCw,
  PhoneOff,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { VideoPlayer } from '../components/VideoPlayer';
import { LiveChat } from '../components/LiveChat';
import { ParticipantsList } from '../components/ParticipantsList';
import { VideoQueue } from '../components/VideoQueue';
import { InviteModal } from '../components/InviteModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { RoomSettingsModal } from '../components/RoomSettingsModal';
import { ChangeVideoModal } from '../components/ChangeVideoModal';
import { api } from '../services/api';
import { PROVIDER_META } from '../utils/resolver';

interface WatchRoomPageProps {
  roomId: string;
  token: string;
  userName: string;
  onLeaveRoom: () => void;
}

export const WatchRoomPage: React.FC<WatchRoomPageProps> = ({
  roomId,
  token,
  userName,
  onLeaveRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'queue'>('chat');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [isHostReconnecting, setIsHostReconnecting] = useState(false);
  const [hostReconnectCountdown, setHostReconnectCountdown] = useState(30);
  const [isRoomTerminated, setIsRoomTerminated] = useState(false);
  const [roomTerminationReason, setRoomTerminationReason] = useState('');
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const p2pSignalRef = useRef<((senderId: string, payload: any) => void) | null>(null);
  const p2pStateRef = useRef<((senderId: string, state: any) => void) | null>(null);

  const {
    connectionStatus,
    metadata,
    playbackState,
    hostId,
    participants,
    chatMessages,
    queue,
    reactions,
    isLocked,
    emitPlay,
    emitPause,
    emitSeek,
    emitRate,
    emitVideoChange,
    emitChatMessage,
    emitRetryMessage,
    emitReaction,
    emitTransferHost,
    emitKickMember,
    emitToggleLock,
    emitAddToQueue,
    emitRemoveFromQueue,
    emitPlayNextQueue,
    emitP2PStreamSignal,
    emitP2PStreamState,
    emitTerminateRoom,
    emitLeaveRoom,
  } = useRoomSocket({
    roomId,
    token,
    onP2PStreamSignal: (senderId, payload) => p2pSignalRef.current?.(senderId, payload),
    onP2PStreamState: (senderId, state) => p2pStateRef.current?.(senderId, state),
    onHostDisconnected: (_hId, _grace, deadline) => {
      setIsHostReconnecting(true);
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setHostReconnectCountdown(remaining || 30);
    },
    onHostReconnected: () => {
      setIsHostReconnecting(false);
      setHostReconnectCountdown(0);
    },
    onTerminationPending: (deadline, secondsRemaining) => {
      setIsHostReconnecting(true);
      setHostReconnectCountdown(secondsRemaining || Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    },
    onRoomTerminated: (reason) => {
      setIsRoomTerminated(true);
      setRoomTerminationReason(reason || 'The host has left the room. This session has been ended.');
      setIsHostReconnecting(false);
    },
    onKicked: (msg) => {
      alert(msg || 'You were removed from this room.');
      onLeaveRoom();
    },
    onRoomClosed: (reason) => {
      setIsRoomTerminated(true);
      setRoomTerminationReason(reason || 'The room has ended.');
      setIsHostReconnecting(false);
    },
  });

  // Countdown timer for host reconnection grace period
  useEffect(() => {
    if (!isHostReconnecting) return;
    const interval = setInterval(() => {
      setHostReconnectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isHostReconnecting]);

  // Decode session token immediately for instant zero-latency role resolution
  const session = useMemo(() => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }, [token]);

  // Private Route Indexing Protection (noindex, nofollow)
  React.useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    const previousContent = robotsMeta.getAttribute('content') || 'index, follow';
    robotsMeta.setAttribute('content', 'noindex, nofollow');

    return () => {
      robotsMeta?.setAttribute('content', previousContent);
    };
  }, []);

  // Dynamic Document Title
  React.useEffect(() => {
    if (metadata?.title) {
      document.title = `${metadata.title} — Resonance`;
    } else {
      document.title = 'Resonance';
    }
    return () => {
      document.title = 'Resonance';
    };
  }, [metadata?.title]);

  const me = participants.find((p) => p.id === session?.userId || p.name === userName);
  const currentUserId = session?.userId || (me ? me.id : '');
  const effectiveUserName = userName || session?.name || (me ? me.name : 'Host');
  const isHost =
    session?.role === 'host' ||
    (me ? me.role === 'host' : false) ||
    (hostId ? hostId === currentUserId : false);
  const hostParticipant = participants.find((p) => p.role === 'host' || p.id === hostId);
  const hostDisplayName = hostParticipant
    ? hostParticipant.name
    : session?.role === 'host'
    ? effectiveUserName
    : 'Host';

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedRoomId(true);
    setTimeout(() => setCopiedRoomId(false), 2000);
  };

  // Browser confirmation when tab is closed or navigated away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleLeaveClick = () => {
    setIsLeaveConfirmOpen(true);
  };

  const handleConfirmHostLeave = () => {
    setIsLeaveConfirmOpen(false);
    emitTerminateRoom('The host has ended the room session.');
    onLeaveRoom();
  };

  const handleConfirmGuestLeave = () => {
    setIsLeaveConfirmOpen(false);
    emitLeaveRoom();
    onLeaveRoom();
  };

  const currentVideoId = playbackState?.videoId || metadata?.videoId || 'aqz-KE-bpKQ';
  const currentProvider = (playbackState?.provider || metadata?.videoProvider || 'youtube') as any;
  const currentMeta = PROVIDER_META[currentProvider] || PROVIDER_META.youtube;

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#07080a] text-[#f5f5f7] flex flex-col overflow-hidden selection:bg-white/20 selection:text-white">
      {/* Top Navigation */}
      <header className="h-[52px] shrink-0 border-b border-white/[0.06] bg-[#07080a]/95 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-30">
        {/* Left: Minimal Leave + Room ID */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleLeaveClick}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white px-2.5 py-1.5 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isHost ? 'End room for everyone' : 'Leave watch party'}
          >
            <ChevronLeft className="w-4 h-4 -ml-1 text-white/50" />
            <span className="font-medium">{isHost ? 'End Room' : 'Leave'}</span>
          </button>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2 min-w-0">
            {/* Subtle Room ID Pill with Click to Copy */}
            <button
              onClick={handleCopyRoomId}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1 rounded-full transition-all cursor-pointer"
              title="Click to copy room ID"
            >
              <span className="text-white/30 text-[10px]">Room</span>
              <span className="font-semibold text-white/80">{roomId}</span>
              {copiedRoomId ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-white/30" />
              )}
            </button>

            {/* Creator / Viewer Micro-indicator */}
            {isHost ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                <Crown className="w-2.5 h-2.5 text-amber-400" /> Host
              </span>
            ) : null}

            {isLocked && (
              <span className="text-rose-400 text-[10px] sm:text-[11px] font-medium flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full" title="Room is private">
                <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">Locked</span>
              </span>
            )}

            {connectionStatus === 'reconnecting' && (
              <span className="text-amber-400 text-[10px] flex items-center gap-1 animate-pulse">
                <RotateCw className="w-2.5 h-2.5 animate-spin" /> Reconnecting
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Change Video Button (Desktop Only) */}
          {isHost && (
            <button
              onClick={() => setIsChangeVideoOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              title="Change Video Source"
            >
              <Film className="w-3.5 h-3.5 text-white/60" />
              <span>Change Video</span>
            </button>
          )}

          {/* Upgrade Button (Host Only) */}
          {isHost && (
            <button
              onClick={() => setIsUpgradeOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 rounded-full transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Upgrade</span>
            </button>
          )}

          {/* Invite Button: Apple-style High Contrast Pill */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-black bg-white hover:bg-white/90 px-3.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-black" />
            <span>Invite</span>
          </button>

          {/* Room Settings (Creator Only) */}
          {isHost && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Room Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Section 15: Host Reconnecting Grace Period Banner */}
      {isHostReconnecting && !isRoomTerminated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-200 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-medium">
              The host has temporarily disconnected. Room session is suspended.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 text-amber-300">
            <span>Terminating in {hostReconnectCountdown}s</span>
          </div>
        </div>
      )}

      {/* Main Experience: Video Canvas + Sidebar */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Video Canvas */}
        <div className="w-full lg:flex-1 min-w-0 min-h-0 flex flex-col p-0 sm:p-3 lg:p-5 shrink-0 lg:overflow-y-auto">
          {/* 16:9 Cinematic Video Player Container */}
          <div className="w-full aspect-video sm:rounded-2xl overflow-hidden bg-black border-b sm:border border-white/[0.06] shadow-2xl relative shrink-0">
            <VideoPlayer
              videoId={currentVideoId}
              provider={currentProvider}
              videoUrl={metadata?.videoUrl || currentVideoId}
              compatibility={metadata?.compatibility}
              playbackMode={metadata?.playbackMode}
              isHost={isHost}
              hostName={hostDisplayName}
              authoritativePlayback={playbackState}
              reactions={reactions}
              onTriggerReaction={(emoji, type) => emitReaction(emoji, type)}
              onHostPlay={(pos) => emitPlay(pos)}
              onHostPause={(pos) => emitPause(pos)}
              onHostSeek={(pos) => emitSeek(pos)}
              onHostRate={(rate) => emitRate(rate)}
              onPlayNextQueue={() => emitPlayNextQueue()}
              hasQueueItem={queue.length > 0}
              roomId={roomId}
              hostId={hostId}
              myParticipantId={session?.userId || 'me'}
              participants={participants}
              emitP2PStreamSignal={emitP2PStreamSignal}
              emitP2PStreamState={emitP2PStreamState}
              onIncomingSignalRef={p2pSignalRef}
              onIncomingStateRef={p2pStateRef}
              onStopSharingLocal={() => {
                setIsChangeVideoOpen(true);
              }}
            />
          </div>
        </div>

        {/* Right Side: Integrated Sidebar */}
        <div className="flex-1 min-h-0 w-full lg:w-[350px] xl:w-[380px] 2xl:w-[420px] flex flex-col lg:h-full lg:shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-[#0a0c10]">
          {/* Segmented Tab Switcher */}
          <div className="p-3 border-b border-white/[0.06] shrink-0">
            <div className="grid grid-cols-3 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06] text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                {chatMessages.length > 0 && (
                  <span className="text-[10px] text-white/40">({chatMessages.length})</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('participants')}
                className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'participants'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>People</span>
                <span className="text-[10px] text-white/40">({participants.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Queue</span>
                {queue.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {activeTab === 'chat' && (
              <LiveChat
                messages={chatMessages}
                currentUserId={currentUserId}
                connectionStatus={connectionStatus}
                reactions={reactions}
                onSendMessage={(text) => emitChatMessage(text)}
                onSendReaction={(emoji, type) => emitReaction(emoji, type)}
                onRetryMessage={(msg) => emitRetryMessage(msg)}
              />
            )}

            {activeTab === 'participants' && (
              <ParticipantsList
                participants={participants}
                currentUserId={currentUserId}
                isHost={isHost}
                maxParticipants={metadata?.maxParticipants || 3}
                onKickMember={(id) => emitKickMember(id)}
                onTransferHost={(id) => emitTransferHost(id)}
                onOpenInvite={() => setIsInviteOpen(true)}
                onOpenUpgrade={() => setIsUpgradeOpen(true)}
              />
            )}

            {activeTab === 'queue' && (
              <VideoQueue
                queue={queue}
                isHost={isHost}
                onAddToQueue={(vId, title, thumb) => emitAddToQueue(vId, title, thumb)}
                onRemoveFromQueue={(id) => emitRemoveFromQueue(id)}
                onPlayNext={() => emitPlayNextQueue()}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={roomId}
        roomTitle={metadata?.title}
        isPrivate={isLocked}
      />

      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        roomId={roomId}
        token={token}
      />

      <RoomSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isLocked={isLocked}
        hasPasscode={Boolean(metadata?.hasPasscode)}
        isHost={isHost}
        onOpenChangeVideo={() => {
          setIsSettingsOpen(false);
          setIsChangeVideoOpen(true);
        }}
        onToggleLock={async (locked, passcode) => {
          try {
            await api.lockRoom(roomId, token, locked, passcode);
            emitToggleLock(locked, passcode);
          } catch (err) {
            console.error('Failed to toggle lock:', err);
            throw err;
          }
        }}
      />

      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        onClose={() => setIsChangeVideoOpen(false)}
        onChangeVideo={(vId, title, prov) => emitVideoChange(vId, title, prov)}
      />

      {/* Leave / Terminate Room Confirmation Modal */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-[#0c0e14] border border-white/10 p-5 sm:p-6 shadow-2xl text-center">
            {isHost ? (
              <>
                <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">End Room for Everyone?</h3>
                <p className="mt-2 text-xs text-white/60 leading-relaxed">
                  As the host, leaving will <span className="text-rose-300 font-medium">terminate this room session</span> for all participants immediately. No one will be able to continue watching.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={() => setIsLeaveConfirmOpen(false)}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmHostLeave}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 cursor-pointer"
                  >
                    End & Terminate
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 mb-4 shadow-lg">
                  <LogOut className="w-6 h-6 text-white/80" />
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">Leave Watch Room?</h3>
                <p className="mt-2 text-xs text-white/60 leading-relaxed">
                  Are you sure you want to leave this watch party? You can re-join anytime using the room link.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={() => setIsLeaveConfirmOpen(false)}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Stay
                  </button>
                  <button
                    onClick={handleConfirmGuestLeave}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-black bg-white hover:bg-white/90 active:bg-white/80 transition-colors shadow-lg cursor-pointer"
                  >
                    Leave Room
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Section 15B: Room Terminated Modal for Everyone */}
      {isRoomTerminated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-2xl bg-[#0B0F17] border border-white/10 p-6 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <PhoneOff className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Room ended</h2>
            <p className="mt-2 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
              {roomTerminationReason || 'The host has left the room. This session has been ended.'}
            </p>
            <div className="mt-6">
              <button
                onClick={onLeaveRoom}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-black bg-white hover:bg-white/90 shadow-lg transition-all"
              >
                Return to Resonance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchRoomPage;
