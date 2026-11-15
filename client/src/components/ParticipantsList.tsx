import React from 'react';
import { Crown, UserMinus, UserCheck, Share2, Sparkles } from 'lucide-react';
import { Participant } from '../types';

interface ParticipantsListProps {
  participants: Participant[];
  currentUserId: string;
  isHost: boolean;
  maxParticipants: number;
  onKickMember: (memberId: string) => void;
  onTransferHost: (memberId: string) => void;
  onOpenInvite: () => void;
  onOpenUpgrade?: () => void;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  currentUserId,
  isHost,
  maxParticipants,
  onKickMember,
  onTransferHost,
  onOpenInvite,
  onOpenUpgrade,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0c10] text-white p-4">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-xs font-medium text-white/90">In this Room</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            {participants.length} of {maxParticipants} active
          </p>
        </div>
        <button
          onClick={onOpenInvite}
          className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] px-3 py-1.5 rounded-lg transition-colors"
        >
          <Share2 className="w-3 h-3" />
          <span>Invite</span>
        </button>
      </div>

      {/* Capacity upgrade prompt if full */}
      {participants.length >= maxParticipants && onOpenUpgrade && (
        <div className="my-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] text-white/60">
            Room capacity reached ({maxParticipants})
          </span>
          <button
            onClick={onOpenUpgrade}
            className="text-[11px] font-medium text-white hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Upgrade
          </button>
        </div>
      )}

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1.5 scrollbar-none">
        {participants.map((p) => {
          const isMe = p.id === currentUserId;
          const isParticipantHost = p.role === 'host';

          return (
            <div
              key={p.id}
              className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs text-white flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.color || '#6366f1' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white/90 truncate max-w-[120px]">
                      {p.name}
                    </span>
                    {isMe && <span className="text-[10px] text-white/40 font-normal">(You)</span>}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/40 mt-0.5">
                    {isParticipantHost ? (
                      <span className="flex items-center gap-0.5 text-amber-300">
                        <Crown className="w-2.5 h-2.5" /> Host
                      </span>
                    ) : (
                      <span>Viewer</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Host Actions on Members */}
              {isHost && !isMe && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onTransferHost(p.id)}
                    className="p-1.5 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                    title="Make Room Host"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onKickMember(p.id)}
                    className="p-1.5 rounded-md hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                    title="Remove from Room"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantsList;
