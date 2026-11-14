import React, { useState, useRef, useEffect } from 'react';
import {
  Share2,
  Settings,
  Sparkles,
  MessageSquare,
  Users,
  ListPlus,
  Lock,
  Radio,
  LogOut,
  RotateCw,
  Film,
  Eye,
  Crown,
  Video,
} from 'lucide-react';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useLiveKitCall, CallMode } from '../hooks/useLiveKitCall';
import { VideoPlayer } from '../components/VideoPlayer';
import { LiveChat } from '../components/LiveChat';
import { ParticipantsList } from '../components/ParticipantsList';
import { VideoQueue } from '../components/VideoQueue';
import { InviteModal } from '../components/InviteModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { RoomSettingsModal } from '../components/RoomSettingsModal';
import { ChangeVideoModal } from '../components/ChangeVideoModal';
import { VideoCallGrid } from '../components/VideoCallGrid';

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
  const [roomTheme, setRoomTheme] = useState('obsidian');

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
    isCallActive,
    callMode,
    callParticipants,
    callHostName,
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
    emitStartCall,
    emitEndCall,
    emitJoinCall,
    emitLeaveCall,
  } = useRoomSocket({
    roomId,
    token,
    onKicked: (msg) => {
      alert(msg || 'You were kicked from this room.');
      onLeaveRoom();
    },
    onRoomClosed: (reason) => {
      alert(reason || 'The room has ended.');
      onLeaveRoom();
    },
  });

  // Decode session token immediately for instant zero-latency role resolution
  const session = React.useMemo(() => {
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
    } catch (e) {
      return null;
    }
  }, [token]);

  // Determine current user identity
  const me = participants.find((p) => p.id === session?.userId || p.name === userName);
  const currentUserId = session?.userId || (me ? me.id : '');
  const effectiveUserName = userName || session?.name || (me ? me.name : 'Host');
  const isHost = session?.role === 'host' || (me ? me.role === 'host' : false) || (hostId ? hostId === currentUserId : false);
  const hostParticipant = participants.find((p) => p.role === 'host' || p.id === hostId);
  const hostDisplayName = hostParticipant ? hostParticipant.name : (session?.role === 'host' ? effectiveUserName : callHostName || 'Host');

  // Unified LiveKit Calling Hook (First-class Audio & Video Calling)
  const {
    isInCall,
    activeCallMode,
    isConnecting,
    callError,
    isMicMuted,
    isCameraOff,
    localStream,
    remoteStreams,
    speakingParticipants,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
  } = useLiveKitCall({
    roomId,
    token,
    currentUserId,
    currentUserName: userName,
    isCallActive,
    callMode,
    callParticipants,
  });

  const handleStartCall = async (mode: CallMode) => {
    if (!isHost) return;
    emitStartCall(mode);
    await joinCall(mode);
  };

  const handleEndCall = () => {
    if (!isHost) return;
    leaveCall();
    emitEndCall();
  };

  const handleJoinCall = async (mode?: CallMode) => {
    emitJoinCall();
    await joinCall(mode || callMode || 'video');
  };

  const handleLeaveCall = () => {
    leaveCall();
    emitLeaveCall();
  };

  const currentVideoId = playbackState?.videoId || metadata?.videoId || 'aqz-KE-bpKQ';

  const getThemeClass = (theme: string) => {
    switch (theme) {
      case 'purple':
        return 'bg-[#0b0517]';
      case 'cyberpunk':
        return 'bg-[#040e14]';
      case 'emerald':
        return 'bg-[#04120a]';
      default:
        return 'bg-[#08080a]';
    }
  };

  return (
    <div className={`min-h-screen ${getThemeClass(roomTheme)} text-white flex flex-col`}>
      {/* Watch Room Top Bar */}
      <header className="h-14 border-b border-dark-700/70 bg-dark-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-dark-800 transition-colors"
            title="Leave room"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <div className="h-4 w-px bg-dark-700 hidden sm:block" />

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {metadata?.title || 'Together Watch Party'}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1 font-mono">
                Room: <strong className="text-brand-300">{roomId}</strong>
              </span>
              {isHost ? (
                <span className="inline-flex items-center gap-0.5 text-amber-300 font-semibold bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                  <Crown className="w-2.5 h-2.5" /> Room Creator
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-gray-400 bg-dark-800 px-1.5 py-0.2 rounded border border-dark-700">
                  <Eye className="w-2.5 h-2.5 text-brand-400" /> Viewer
                </span>
              )}
              {isCallActive && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded animate-pulse">
                  <Video className="w-2.5 h-2.5" /> Call Live
                </span>
              )}
              {isLocked && (
                <span className="text-red-400 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
              {connectionStatus === 'reconnecting' && (
                <span className="text-amber-400 flex items-center gap-0.5 animate-pulse">
                  <RotateCw className="w-2.5 h-2.5 animate-spin" /> Reconnecting
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Creator-only "Start Group Call" quick trigger if call is not active yet */}
          {isHost && !isCallActive && (
            <button
              onClick={() => handleStartCall('video')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
              title="Start a group video call for the room"
            >
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>Group Call</span>
            </button>
          )}

          {/* Upgrade to Premium Button: Creator Only */}
          {isHost && (
            <button
              onClick={() => setIsUpgradeOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Upgrade Room</span>
              <span className="sm:hidden">₹199</span>
            </button>
          )}

          {/* Invite Friends Button: Available to everyone (Creator & Viewers) */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg shadow-sm transition-all hover:scale-[1.02]"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>

          {/* Room Settings: Only Creator can open room settings */}
          {isHost && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              title="Room Settings (Creator only)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main 72% Video / 28% Sidebar Layout (Section 15.2) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Video & Call Area (~72%) */}
        <div className="w-full lg:w-[72%] flex flex-col p-2 sm:p-4 lg:p-6 overflow-y-auto">
          {/* Main YouTube Video Player */}
          <div className="w-full aspect-video rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black border border-dark-800">
            <VideoPlayer
              videoId={currentVideoId}
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
            />
          </div>

          {/* Live Group Calling Section: Unified Audio and Video Calling */}
          <VideoCallGrid
            isCallActive={isCallActive}
            callMode={callMode}
            isInCall={isInCall}
            isConnecting={isConnecting}
            callError={callError}
            isHost={isHost}
            hostName={hostDisplayName}
            localStream={localStream}
            remoteStreams={remoteStreams}
            speakingParticipants={speakingParticipants}
            isMicMuted={isMicMuted}
            isCameraOff={isCameraOff}
            participants={participants}
            currentUserId={currentUserId}
            onJoinCall={handleJoinCall}
            onLeaveCall={handleLeaveCall}
            onStartCall={handleStartCall}
            onEndCall={handleEndCall}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
          />

          {/* Video Metadata & Controls Under Player */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-900/60 border border-dark-800">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {metadata?.title || 'YouTube Video'}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>Direct Provider Embed</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Radio className="w-3 h-3 animate-pulse" /> Live Realtime Room
                </span>
                <span>•</span>
                <span>{participants.length} Active Viewers</span>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-2">
              {/* Creator-only "Change Video" action */}
              {isHost ? (
                <button
                  onClick={() => setIsChangeVideoOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-white bg-brand-500/20 hover:bg-brand-500/30 px-3 py-1.5 rounded-lg border border-brand-500/40 transition-colors shadow-sm"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Change Video</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800/80 px-3 py-1.5 rounded-lg border border-dark-700/60">
                  <Eye className="w-3.5 h-3.5 text-brand-400" />
                  <span>Watching with Host</span>
                </div>
              )}

              {/* Share Link: Available to everyone */}
              <button
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-dark-800 hover:bg-dark-700 px-3 py-1.5 rounded-lg border border-dark-700 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Area (~28%) */}
        <div className="w-full lg:w-[28%] flex flex-col h-[500px] lg:h-auto border-t lg:border-t-0 border-dark-700/70 bg-dark-900">
          {/* Tab Navigation */}
          <div className="flex border-b border-dark-700/70 bg-dark-850/60 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-brand-500 text-white bg-dark-800/40'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              <span className="text-[10px] text-gray-400">({chatMessages.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'participants'
                  ? 'border-brand-500 text-white bg-dark-800/40'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>People</span>
              <span className="text-[10px] text-gray-400">
                ({participants.length}/{metadata?.maxParticipants || 3})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'queue'
                  ? 'border-brand-500 text-white bg-dark-800/40'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Queue</span>
              {queue.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
              )}
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
              <LiveChat
                messages={chatMessages}
                currentUserId={currentUserId}
                connectionStatus={connectionStatus}
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
                onKickMember={(memberId) => emitKickMember(memberId)}
                onTransferHost={(memberId) => emitTransferHost(memberId)}
                onOpenInvite={() => setIsInviteOpen(true)}
                onOpenUpgrade={isHost ? () => setIsUpgradeOpen(true) : undefined}
              />
            )}

            {activeTab === 'queue' && (
              <VideoQueue
                queue={queue}
                isHost={isHost}
                onAddToQueue={(vid, title, thumb) => emitAddToQueue(vid, title, thumb)}
                onRemoveFromQueue={(itemId) => emitRemoveFromQueue(itemId)}
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
        isPrivate={metadata?.isPrivate}
        passcode={metadata?.passcode}
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
        onToggleLock={(locked) => emitToggleLock(locked)}
        currentTheme={roomTheme}
        onChangeTheme={(th) => setRoomTheme(th)}
        isHost={isHost}
        maxParticipants={metadata?.maxParticipants || 3}
      />

      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        onClose={() => setIsChangeVideoOpen(false)}
        onChangeVideo={(vid, title) => emitVideoChange(vid, title)}
      />
    </div>
  );
};
