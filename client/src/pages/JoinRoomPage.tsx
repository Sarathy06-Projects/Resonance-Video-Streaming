import React, { useState, useEffect } from 'react';
import { Play, Lock, Users, AlertCircle, ArrowRight, ShieldCheck, ChevronLeft } from 'lucide-react';
import { api } from '../services/api';

interface JoinRoomPageProps {
  roomId: string;
  onJoined: (roomId: string, token: string, guestName: string) => void;
  onGoHome: () => void;
}

export const JoinRoomPage: React.FC<JoinRoomPageProps> = ({
  roomId,
  onJoined,
  onGoHome,
}) => {
  const [roomData, setRoomData] = useState<any>(null);
  const [guestName, setGuestName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingToken = localStorage.getItem(`together_token_${roomId}`);

    api
      .getRoom(roomId)
      .then(async (data) => {
        setRoomData(data);
        if (existingToken) {
          try {
            const joinRes = await api.joinRoom(roomId, {
              guestName: '',
              existingToken,
            });
            if (joinRes.success) {
              onJoined(roomId, joinRes.token, joinRes.name);
              return;
            }
          } catch (e) {}
        }
      })
      .catch((err) => {
        setError(err.message || 'Room not found or has expired');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roomId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim() || `Guest_${Math.floor(100 + Math.random() * 900)}`;

    setJoining(true);
    setError('');

    try {
      const res = await api.joinRoom(roomId, {
        guestName: name,
        passcode: passcode.trim(),
      });

      if (res.success && res.token) {
        localStorage.setItem(`together_token_${roomId}`, res.token);
        onJoined(roomId, res.token, name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080a] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
        <p className="text-xs text-white/50">Connecting to room...</p>
      </div>
    );
  }

  if (error && !roomData) {
    return (
      <div className="min-h-screen bg-[#07080a] flex flex-col items-center justify-center p-4 text-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/60 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-medium text-white mb-1.5">Room Unavailable</h2>
        <p className="text-xs text-white/50 max-w-sm mb-6">{error}</p>
        <button
          onClick={onGoHome}
          className="px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] flex flex-col items-center justify-center p-4 text-white selection:bg-white/20">
      <div className="w-full max-w-md bg-[#0d0f14] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl relative text-left">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-3 text-white">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
          <h2 className="text-lg font-medium text-white tracking-tight">Join Watch Party</h2>
          <p className="text-xs text-white/40 mt-1">
            Room: <span className="font-mono text-white/70 font-medium">{roomId}</span>
          </p>
        </div>

        {/* Video Preview Card */}
        {roomData && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-5 flex items-center gap-3">
            <img
              src={`https://img.youtube.com/vi/${roomData.videoId}/hqdefault.jpg`}
              alt="Video Thumbnail"
              className="w-16 h-10 object-cover rounded-lg bg-black/40 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{roomData.title}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-white/50" />
                  {roomData.currentParticipants} of {roomData.maxParticipants} watching
                </span>
                {roomData.isLocked && (
                  <span className="text-rose-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Passcode
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Locked / Capacity Notices */}
        {roomData?.isLocked && !roomData?.hasPasscode ? (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center mb-4">
            <p className="text-xs text-rose-300">
              This room is currently locked by the host.
            </p>
          </div>
        ) : roomData?.currentParticipants >= roomData?.maxParticipants ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center mb-4">
            <p className="text-xs text-amber-300">
              Room is full ({roomData.maxParticipants} participants max).
            </p>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={30}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-colors"
              />
            </div>

            {/* Passcode if Private */}
            {roomData?.hasPasscode && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-white/40" />
                  <span>Passcode Required</span>
                </label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-colors"
                />
              </div>
            )}

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={joining}
              className="w-full py-2.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <span>{joining ? 'Entering Room...' : 'Enter Watch Room'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40">
          <button
            onClick={onGoHome}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Back
          </button>
          <span className="flex items-center gap-1 text-white/50">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> No signup required
          </span>
        </div>
      </div>
    </div>
  );
};

export default JoinRoomPage;
