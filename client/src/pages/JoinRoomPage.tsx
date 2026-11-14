import React, { useState, useEffect } from 'react';
import { Play, Lock, Users, AlertCircle, ArrowRight, ShieldCheck, Database } from 'lucide-react';
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
    // Check if user already has a token in localStorage for this room
    const existingToken = localStorage.getItem(`together_token_${roomId}`);

    api.getRoom(roomId)
      .then(async (data) => {
        setRoomData(data);
        if (existingToken) {
          // Attempt automatic reconnect with saved session
          try {
            const joinRes = await api.joinRoom(roomId, {
              guestName: '',
              existingToken,
            });
            if (joinRes.success) {
              onJoined(roomId, joinRes.token, joinRes.name);
              return;
            }
          } catch (e) {
            // Reconnect failed, prompt for display name
          }
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
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">Connecting to room...</p>
      </div>
    );
  }

  if (error && !roomData) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Room Unavailable</h2>
        <p className="text-sm text-gray-400 max-w-sm mb-6">{error}</p>
        <button
          onClick={onGoHome}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-dark-900 border border-dark-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/20">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </div>
          <h2 className="text-xl font-bold text-white">Join Watch Party</h2>
          <p className="text-xs text-gray-400 mt-1">
            Room Code: <span className="font-mono text-brand-300 font-semibold">{roomId}</span>
          </p>
        </div>

        {/* Video Preview Card */}
        {roomData && (
          <div className="p-3 rounded-xl bg-dark-850 border border-dark-750 mb-5 flex items-center gap-3">
            <img
              src={`https://img.youtube.com/vi/${roomData.videoId}/hqdefault.jpg`}
              alt="Video Thumbnail"
              className="w-20 h-12 object-cover rounded-lg bg-dark-950 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{roomData.title}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-brand-400" />
                  {roomData.currentParticipants} / {roomData.maxParticipants} watching
                </span>
                {roomData.isLocked && (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Locked / Capacity Notices */}
        {roomData?.isLocked ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center mb-4">
            <p className="text-xs text-red-300 font-medium">
              This room has been locked by the host. No new participants may join.
            </p>
          </div>
        ) : roomData?.currentParticipants >= roomData?.maxParticipants ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center mb-4">
            <p className="text-xs text-amber-300 font-medium">
              Room is full ({roomData.maxParticipants} participants max).
            </p>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. PopcornLover"
                maxLength={30}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Passcode if Private */}
            {roomData?.hasPasscode && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Room Passcode Required</span>
                </label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter room passcode"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={joining}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{joining ? 'Entering Room...' : 'Enter Watch Room'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-dark-700/60 flex items-center justify-between text-[11px] text-gray-500">
          <button onClick={onGoHome} className="hover:text-gray-300 transition-colors">
            ← Back to Home
          </button>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> No signup required
          </span>
        </div>
      </div>
    </div>
  );
};
