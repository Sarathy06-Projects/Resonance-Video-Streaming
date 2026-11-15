import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { LandingPage } from './pages/LandingPage';

// Code-split heavy routes and components so the initial mobile bundle is ultra-lightweight
const WatchRoomPage = lazy(() => import('./pages/WatchRoomPage').then(m => ({ default: m.WatchRoomPage })));
const JoinRoomPage = lazy(() => import('./pages/JoinRoomPage').then(m => ({ default: m.JoinRoomPage })));
const WatchVideosTogetherPage = lazy(() => import('./pages/seo/WatchVideosTogetherPage').then(m => ({ default: m.WatchVideosTogetherPage })));
const WatchPartyPage = lazy(() => import('./pages/seo/WatchPartyPage').then(m => ({ default: m.WatchPartyPage })));
const WatchMoviesPage = lazy(() => import('./pages/seo/WatchMoviesPage').then(m => ({ default: m.WatchMoviesPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const UpgradeModal = lazy(() => import('./components/UpgradeModal').then(m => ({ default: m.UpgradeModal })));

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // Sync state with browser location path e.g. /room/a8k92x
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      setCurrentPath(path);

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

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoomCreated = (roomId: string, token: string, hostName: string) => {
    setCurrentRoomId(roomId);
    setRoomToken(token);
    setUserName(hostName);
    localStorage.setItem(`together_token_${roomId}`, token);
    localStorage.setItem(`together_username_${roomId}`, hostName);
    window.history.pushState({}, '', `/room/${roomId}`);
    setCurrentPath(`/room/${roomId}`);
  };

  const handleRoomJoined = (roomId: string, token: string, name: string) => {
    setCurrentRoomId(roomId);
    setRoomToken(token);
    setUserName(name);
    localStorage.setItem(`together_token_${roomId}`, token);
    localStorage.setItem(`together_username_${roomId}`, name);
    window.history.pushState({}, '', `/room/${roomId}`);
    setCurrentPath(`/room/${roomId}`);
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
    setCurrentPath('/');
  };

  const handleStartRoomFromSeo = () => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    setTimeout(() => {
      const el = document.getElementById('room-creator');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Render appropriate view based on route
  const renderContent = () => {
    // 1. Inside Watch Room
    if (currentRoomId && roomToken) {
      return (
        <WatchRoomPage
          roomId={currentRoomId}
          token={roomToken}
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      );
    }

    // 2. Joining Watch Room
    if (currentRoomId && !roomToken) {
      return (
        <JoinRoomPage
          roomId={currentRoomId}
          onJoined={handleRoomJoined}
          onGoHome={handleLeaveRoom}
        />
      );
    }

    // 3. Homepage
    if (currentPath === '/' || currentPath === '') {
      return (
        <main className="flex-1">
          <LandingPage onRoomCreated={handleRoomCreated} />
        </main>
      );
    }

    // 4. Dedicated SEO Landing Pages
    if (currentPath === '/watch-videos-together') {
      return (
        <WatchVideosTogetherPage
          onStartRoom={handleStartRoomFromSeo}
          onGoHome={() => navigateTo('/')}
        />
      );
    }

    if (currentPath === '/watch-party') {
      return (
        <WatchPartyPage
          onStartRoom={handleStartRoomFromSeo}
          onGoHome={() => navigateTo('/')}
        />
      );
    }

    if (currentPath === '/watch-movies-with-friends') {
      return (
        <WatchMoviesPage
          onStartRoom={handleStartRoomFromSeo}
          onGoHome={() => navigateTo('/')}
        />
      );
    }

    // 5. 404 Not Found for any legacy or non-existent URLs
    return <NotFoundPage onGoHome={() => navigateTo('/')} />;
  };

  return (
    <div
      className={`${
        currentRoomId && roomToken
          ? 'h-screen h-[100dvh] overflow-hidden'
          : 'min-h-screen'
      } bg-dark-950 text-gray-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white`}
    >
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        {renderContent()}

        {/* Global Upgrade to Premium Modal */}
        <UpgradeModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
        />
      </Suspense>

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
}

export default App;
