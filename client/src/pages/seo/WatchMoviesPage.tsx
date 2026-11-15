import React, { useEffect } from 'react';
import { Play, ArrowRight, Film, ListPlus, Heart, Users, Sparkles, Moon } from 'lucide-react';

interface SeoPageProps {
  onStartRoom: () => void;
  onGoHome: () => void;
}

export const WatchMoviesPage: React.FC<SeoPageProps> = ({ onStartRoom, onGoHome }) => {
  useEffect(() => {
    document.title = 'Watch Movies Together Online with Friends Remotely — Resonance';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Plan long-distance virtual movie nights. Watch films together online with synchronized playback, shared video queues, and theater-level intimacy.');
    }
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://resonance.org.in/watch-movies-with-friends');
    }

    return () => {
      document.title = 'Resonance — Watch Videos Together Online';
      if (canonicalLink) {
        canonicalLink.setAttribute('href', 'https://resonance.org.in/');
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07080a] text-[#f5f5f7] font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07080a]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); onGoHome(); }}
            className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white group"
          >
            <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-sm group-hover:bg-white/15 transition-all">
              <Play className="w-3 h-3 fill-white ml-0.5" />
            </div>
            <span className="tracking-[-0.03em]">resonance</span>
          </a>

          <button
            onClick={onStartRoom}
            className="text-xs font-semibold bg-white text-black hover:bg-white/90 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Start Movie Night</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40 mb-6 flex items-center gap-2">
          <a href="/" onClick={(e) => { e.preventDefault(); onGoHome(); }} className="hover:text-white/70">Home</a>
          <span>/</span>
          <span className="text-white/70">Guides</span>
          <span>/</span>
          <span className="text-white/90">Watch Movies Together</span>
        </nav>

        <div className="mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-300 mb-4">
            <Moon className="w-3 h-3" />
            <span>Virtual Cinema Experience</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-white leading-tight mb-5">
            Watch Movies Together With Friends Online
          </h1>
          <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-2xl">
            Close the physical distance on movie nights. Experience synchronized film watching with friends, family, and long-distance partners without missing a beat.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Film className="w-5 h-5 text-amber-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Theater Quality 4K</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Stream movies directly from direct MP4 video files, Google Drive, or streaming platforms at maximum source fidelity.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <ListPlus className="w-5 h-5 text-indigo-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Collaborative Queue</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Line up double features, trailers, and short films with a shared Up Next video queue that seamlessly auto-plays.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Heart className="w-5 h-5 text-rose-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Distance-Closing Intimacy</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Shared reactions, simultaneous pauses for snack breaks, and voice calling make long-distance evenings feel effortless.
            </p>
          </div>
        </div>

        {/* Editorial Storytelling */}
        <article className="prose prose-invert max-w-none space-y-10 border-t border-white/[0.08] pt-12 text-sm text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-medium text-white mb-3">The Art of the Virtual Movie Night</h2>
            <p>
              Watching a movie together isn&apos;t just about consuming media—it&apos;s about sharing gasps, whispering theories during plot twists, and pausing together when someone needs to refill their popcorn. Traditional video tools force users to count down &ldquo;3, 2, 1, play&rdquo; over messaging apps, only to realize one person is 15 seconds ahead.
            </p>
            <p className="mt-3">
              Resonance provides authoritative pause, seek, and resume synchronization. When the host pauses for a break, everyone in the room pauses instantly on the exact same frame.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-white mb-3">Best Video Sources for Long-Distance Movie Nights</h2>
            <p>
              Resonance supports multiple convenient ways to stream movies together:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Direct MP4 / WebM URLs:</strong> Paste a direct video link for zero-latency, high-bitrate synchronized playback.</li>
              <li><strong>Google Drive Video Files:</strong> Share private video files directly from Google Drive without uploading to public websites.</li>
              <li><strong>Public Domain & Indie Releases on YouTube/Vimeo:</strong> Stream classic films, indie premieres, and full-length documentaries effortlessly.</li>
            </ul>
          </section>
        </article>

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#10131c] to-[#0a0c10] text-center">
          <h2 className="text-xl sm:text-2xl font-medium text-white mb-2">Plan your movie night</h2>
          <p className="text-xs sm:text-sm text-white/50 max-w-md mx-auto mb-6">
            Get your film ready, grab your popcorn, and invite your favorite person.
          </p>
          <button
            onClick={onStartRoom}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer"
          >
            Start Virtual Movie Night
          </button>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Resonance. Virtual movie nights with friends.</p>
      </footer>
    </div>
  );
};

export default WatchMoviesPage;
