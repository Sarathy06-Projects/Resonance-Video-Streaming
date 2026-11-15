import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { WatchRoomPage } from './pages/WatchRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { UpgradeModal } from './components/UpgradeModal';

export function App() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // Sync state with browser location path e.g. /room/a8k92x
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      const match = path.match(/\/room\/([a-zA-Z0-9_-]+)/);
      if (match) {
        const roomId = match[1];
        setCurrentRoomId(roomId);
        const savedToken = localStorage.getItem(`together_token_${roomId}`);
        const savedName = localStorage.getItem(`together_username_${roomId}`);
        if (savedToken) {
          setRoomToken(savedToken);
        }
        if (savedName) {
          setUserName(savedName);
        }
      } else {
        setCurrentRoomId(null);
        setRoomToken(null);
        setUserName('');
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  const handleRoomCreated = (roomId: string, token: string, hostName: string) => {
    setCurrentRoomId(roomId);
    setRoomToken(token);
    setUserName(hostName);
    localStorage.setItem(`together_token_${roomId}`, token);
    localStorage.setItem(`together_username_${roomId}`, hostName);
    window.history.pushState({}, '', `/room/${roomId}`);
  };

  const handleRoomJoined = (roomId: string, token: string, name: string) => {
    setCurrentRoomId(roomId);
    setRoomToken(token);
    setUserName(name);
    localStorage.setItem(`together_token_${roomId}`, token);
    localStorage.setItem(`together_username_${roomId}`, name);
    window.history.pushState({}, '', `/room/${roomId}`);
  };

  const handleLeaveRoom = () => {
    if (currentRoomId) {
      localStorage.removeItem(`together_token_${currentRoomId}`);
      localStorage.removeItem(`together_username_${currentRoomId}`);
    }
    setCurrentRoomId(null);
    setRoomToken(null);
    setUserName('');
    window.history.pushState({}, '', '/');
  };

  return (
    <div
      className={`${
        currentRoomId && roomToken
          ? 'h-screen h-[100dvh] overflow-hidden'
          : 'min-h-screen'
      } bg-dark-950 text-gray-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white`}
    >
      {/* If in watch room, we render watch room directly with its integrated top bar */}
      {currentRoomId && roomToken ? (
        <WatchRoomPage
          roomId={currentRoomId}
          token={roomToken}
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : currentRoomId && !roomToken ? (
        <JoinRoomPage
          roomId={currentRoomId}
          onJoined={handleRoomJoined}
          onGoHome={handleLeaveRoom}
        />
      ) : (
        <main className="flex-1">
          <LandingPage
            onRoomCreated={handleRoomCreated}
          />
        </main>
      )}

      {/* Global Upgrade to Premium Modal */}
      <UpgradeModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
}

export default App;
