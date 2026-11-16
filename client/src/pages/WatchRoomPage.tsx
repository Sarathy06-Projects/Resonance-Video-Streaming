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

  const handleLeaveClick = () => {
    if (isHost) {
      setIsLeaveConfirmOpen(true);
    } else {
      emitLeaveRoom();
      onLeaveRoom();
    }
  };

  const handleConfirmHostLeave = () => {
    setIsLeaveConfirmOpen(false);
    emitTerminateRoom('The host has ended the room session.');
    onLeaveRoom();
  };

  const currentVideoId = playbackState?.videoId || metadata?.videoId || 'aqz-KE-bpKQ';
  const currentProvider = (playbackState?.provider || metadata?.videoProvider || 'youtube') as any;
  const currentMeta = PROVIDER_META[currentProvider] || PROVIDER_META.youtube;

  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-[#07080a] text-[#f5f5f7] flex flex-col overflow-hidden selection:bg-white/20 selection:text-white">
      {/* Top Navigation */}
      <header className="h-[52px] shrink-0 border-b border-white/[0.06] bg-[#07080a]/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
        {/* Left: Minimal Leave + Title + Room ID */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleLeaveClick}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white px-2.5 py-1.5 rounded-full hover:bg-white/[0.06] transition-colors"
            title={isHost ? 'End room for everyone' : 'Leave watch party'}
          >
            <ChevronLeft className="w-4 h-4 -ml-1 text-white/50" />
            <span className="font-medium">{isHost ? 'End Room' : 'Leave'}</span>
          </button>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-medium text-white/90 truncate max-w-[160px] sm:max-w-xs md:max-w-md tracking-tight">
              {metadata?.title || 'Watch Party'}
            </h1>

            {/* Subtle Room ID Pill with Click to Copy */}
            <button
              onClick={handleCopyRoomId}
              className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-white/40 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-2 py-0.5 rounded-md transition-all"
              title="Click to copy room ID"
            >
              <span>{roomId}</span>
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
              <span className="text-rose-400 text-[10px] flex items-center gap-0.5" title="Room is private">
                <Lock className="w-2.5 h-2.5" />
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
            className="flex items-center gap-1.5 text-xs font-medium text-black bg-white hover:bg-white/90 px-3.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-[1.01]"
          >
            <Share2 className="w-3.5 h-3.5 text-black" />
            <span>Invite</span>
          </button>

          {/* Room Settings (Creator Only) */}
          {isHost && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
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
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Side: Video Canvas & Controls */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col p-0 sm:p-4 lg:p-5 overflow-y-auto">
          {/* 16:9 Cinematic Video Player Container (Fully Mobile-Responsive & Sticky) */}
          <div className="w-full aspect-video sm:rounded-2xl overflow-hidden bg-black border-b sm:border border-white/[0.06] shadow-2xl relative sticky top-0 lg:static z-20 shrink-0">
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

          {/* Refined Video Information Layout */}
          <div className="p-3.5 sm:p-0 mt-2 sm:mt-4 pt-1 sm:pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-medium text-white tracking-tight leading-snug">
                {metadata?.title || 'Video Stream'}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                <span className="font-medium text-white/60">{currentMeta.name}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Synchronized
                </span>
                <span>•</span>
                <span>{participants.length} {participants.length === 1 ? 'viewer' : 'viewers'}</span>
              </div>
            </div>

            {/* Quiet Actions */}
            <div className="flex items-center gap-2">
              {isHost && (
                <button
                  onClick={() => setIsChangeVideoOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2 rounded-xl border border-white/[0.08] transition-colors"
                >
                  <Film className="w-3.5 h-3.5 text-white/60" />
                  <span>Change Video</span>
                </button>
              )}

              <button
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2 rounded-xl border border-white/[0.08] transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-white/60" />
                <span>Share Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Integrated Sidebar */}
        <div className="w-full lg:w-[350px] xl:w-[380px] 2xl:w-[420px] flex flex-col h-[520px] lg:h-full min-h-0 shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-[#0a0c10]">
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
        roomId={roomId}
        token={token}
        isLocked={isLocked}
        currentTheme="obsidian"
        onToggleLock={(locked) => emitToggleLock(locked)}
        onSelectTheme={() => {}}
      />

      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        onClose={() => setIsChangeVideoOpen(false)}
        onChangeVideo={(vId, title, prov) => emitVideoChange(vId, title, prov)}
      />

      {/* Section 15: Host Voluntary Leave Confirmation Modal */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-[#0B0F17] border border-white/10 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">End Room for Everyone?</h3>
            <p className="mt-2 text-xs text-white/60 leading-relaxed">
              As the host, leaving will terminate this room session for all participants. No one will be able to continue watching.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsLeaveConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmHostLeave}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20"
              >
                End Room & Leave
              </button>
            </div>
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
