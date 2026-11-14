import React from 'react';
import { Crown, UserMinus, UserCheck, Share2, Sparkles, Shield } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-700/70 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-dark-700/70">
        <div>
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            <span>Participants</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-dark-800 text-gray-300 border border-dark-700">
              {participants.length} / {maxParticipants}
            </span>
          </h3>
        </div>
        <button
          onClick={onOpenInvite}
          className="flex items-center gap-1.5 text-xs text-white bg-brand-600 hover:bg-brand-500 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
        >
          <Share2 className="w-3 h-3" />
          <span>Invite</span>
        </button>
      </div>

      {/* Capacity Upgrade Notice if near limit */}
      {participants.length >= maxParticipants && onOpenUpgrade && (
        <div className="my-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="text-[11px] text-amber-200">
            Room is at capacity ({maxParticipants} max).
          </div>
          <button
            onClick={onOpenUpgrade}
            className="text-[11px] font-semibold text-amber-300 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Upgrade (15 max)
          </button>
        </div>
      )}

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {participants.map((p) => {
          const isMe = p.id === currentUserId;
          const isParticipantHost = p.role === 'host';

          return (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-dark-850/70 border border-dark-750 hover:border-dark-700 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar with initial */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.color || '#6366f1' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate max-w-[110px]">
                      {p.name}
                    </span>
                    {isMe && <span className="text-[10px] text-gray-400">(You)</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isParticipantHost ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/20 px-1 rounded">
                        <Crown className="w-2.5 h-2.5" /> Room Host
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">Guest Viewer</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Host actions on other members */}
              {isHost && !isMe && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onTransferHost(p.id)}
                    className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Make Host"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onKickMember(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Remove from room"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-dark-700/70 text-[11px] text-gray-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-emerald-500" /> Host-controlled
        </span>
        <span>V1 Serverless</span>
      </div>
    </div>
  );
};
