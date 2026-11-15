import React, { useEffect } from 'react';
import { Play, ArrowRight, CheckCircle2, Shield, Radio, Film, Layers, Globe, Clock, ChevronDown } from 'lucide-react';

interface SeoPageProps {
  onStartRoom: () => void;
  onGoHome: () => void;
}

export const WatchVideosTogetherPage: React.FC<SeoPageProps> = ({ onStartRoom, onGoHome }) => {
  useEffect(() => {
    document.title = 'How to Watch Videos Together Online with Friends — Resonance';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Discover how to watch videos together online with synchronized playback across YouTube, MP4, HLS, Vimeo, and Google Drive with zero browser extensions.');
    }
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://resonance.org.in/watch-videos-together');
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
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07080a]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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
            onClick={onStartRoom}
            className="text-xs font-semibold bg-white text-black hover:bg-white/90 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Start a Room</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-white/40 mb-6 flex items-center gap-2">
          <a href="/" onClick={(e) => { e.preventDefault(); onGoHome(); }} className="hover:text-white/70">Home</a>
          <span>/</span>
          <span className="text-white/70">Guides</span>
          <span>/</span>
          <span className="text-white/90">Watch Videos Together</span>
        </nav>

        {/* Hero Section */}
        <div className="mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-medium text-indigo-300 mb-4">
            <Radio className="w-3 h-3" />
            <span>Universal Playback Engine</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-white leading-tight mb-5">
            How to Watch Videos Together Online With Friends
          </h1>
          <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-2xl">
            Whether you want to stream YouTube deep-dives, Vimeo films, or direct MP4 files with a long-distance friend, Resonance keeps every participant locked to the exact same second in real time.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Layers className="w-5 h-5 text-indigo-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Universal Media Support</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Native support for YouTube, Direct MP4/WebM files, HLS live streams (.m3u8), Vimeo, Twitch, and Google Drive links.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Clock className="w-5 h-5 text-emerald-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Sub-Second Drift Correction</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Continuous heartbeat tracking ensures no viewer drifts behind by more than 500ms, compensating dynamically for latency differences.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Globe className="w-5 h-5 text-sky-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Zero Software Installs</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              No browser extensions, desktop applications, or third-party accounts needed. Friends simply click your link and join instantly.
            </p>
          </div>
        </div>

        {/* Technical Article Body */}
        <article className="prose prose-invert max-w-none space-y-10 border-t border-white/[0.08] pt-12 text-sm text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-medium text-white mb-3">1. Why Traditional Watch Parties Suffer from Drift</h2>
            <p>
              When two or more people try to hit &ldquo;play&rdquo; simultaneously over a Discord or FaceTime call, network lag, varying buffering times, and different browser rendering pipelines quickly cause viewers to drift apart by seconds. By the time one person laughs at a punchline, the other is still waiting for the scene to unfold.
            </p>
            <p className="mt-3">
              Resonance solves this by making one participant the authoritative host while broadcasting clock-synchronized timecodes to all guest players. If a guest drops frames or experiences network fluctuation, the engine gently nudges playback rate back into alignment without abrupt audio interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-white mb-3">2. Step-by-Step: Starting a Synchronized Watch Session</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Paste any supported video URL:</strong> Paste a link from YouTube, Vimeo, direct MP4 URL, or Google Drive on Resonance.</li>
              <li><strong>Set your room name & privacy:</strong> Choose your display name, and optionally toggle a private passcode.</li>
              <li><strong>Copy & share the room link:</strong> Send the generated invite link to friends via iMessage, WhatsApp, Telegram, or Discord.</li>
              <li><strong>Watch & interact in sync:</strong> Play, pause, seek, chat, and start group audio/video calls in the same unified interface.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-medium text-white mb-3">3. Frequently Asked Questions</h2>
            <div className="space-y-4 not-prose">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0c0e14]">
                <h3 className="text-xs font-semibold text-white mb-1">Do my friends need to create an account?</h3>
                <p className="text-xs text-white/50">No. Friends enter their display name and join immediately with zero registration.</p>
              </div>
              <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0c0e14]">
                <h3 className="text-xs font-semibold text-white mb-1">Can we talk while watching?</h3>
                <p className="text-xs text-white/50">Yes. Resonance includes built-in group voice and video calling powered by LiveKit WebRTC.</p>
              </div>
            </div>
          </section>
        </article>

        {/* CTA Card */}
        <div className="mt-16 p-8 rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#10131c] to-[#0a0c10] text-center">
          <h2 className="text-xl sm:text-2xl font-medium text-white mb-2">Ready to watch together?</h2>
          <p className="text-xs sm:text-sm text-white/50 max-w-md mx-auto mb-6">
            Create a room in 5 seconds and bring your favorite people together around any video.
          </p>
          <button
            onClick={onStartRoom}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer"
          >
            Start a Watch Room Now
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Resonance. Watch videos together online.</p>
      </footer>
    </div>
  );
};

export default WatchVideosTogetherPage;
