import React, { useEffect } from 'react';
import { ArrowLeft, Home, Play } from 'lucide-react';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  useEffect(() => {
    document.title = '404: Page Not Found — Resonance';
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    const prev = robotsMeta.getAttribute('content') || 'index, follow';
    robotsMeta.setAttribute('content', 'noindex, nofollow');

    return () => {
      robotsMeta?.setAttribute('content', prev);
      document.title = 'Resonance — Watch Videos Together Online';
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07080a] text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onGoHome();
          }}
          aria-label="Resonance"
          className="flex items-center group transition-opacity hover:opacity-90"
        >
          <img
            src="/resonance-logo-gold.png"
            alt="Resonance"
            className="h-6 w-auto object-contain"
          />
        </a>

        <button
          onClick={onGoHome}
          className="text-xs text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
      </header>

      {/* Main 404 Notice */}
      <main className="max-w-md mx-auto text-center my-auto py-16">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/40 block mb-3">
          404 — Resource Not Found
        </span>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white mb-4">
          This page does not exist or was removed.
        </h1>
        <p className="text-xs sm:text-sm text-white/50 leading-relaxed mb-8">
          The link you followed may be outdated, expired, or part of a previous website identity. Resonance is the new home for watching videos together online.
        </p>
        <button
          onClick={onGoHome}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-all shadow-md cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Watch Party Home</span>
        </button>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-white/30 max-w-5xl mx-auto w-full">
        &copy; {new Date().getFullYear()} Resonance. All rights reserved.
      </footer>
    </div>
  );
};

export default NotFoundPage;
