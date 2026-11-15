import React, { useEffect } from 'react';
import { Play, ArrowRight, Video, MessageSquare, Flame, Heart, Users, Shield, Headphones } from 'lucide-react';

interface SeoPageProps {
  onStartRoom: () => void;
  onGoHome: () => void;
}

export const WatchPartyPage: React.FC<SeoPageProps> = ({ onStartRoom, onGoHome }) => {
  useEffect(() => {
    document.title = 'Host a Watch Party Online with Audio & Video Calling — Resonance';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Host virtual watch parties with friends online. Enjoy synchronized video playback with built-in voice calling, video chat, reactions, and room queueing.');
    }
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://resonance.org.in/watch-party');
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
            <span>Start a Party</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40 mb-6 flex items-center gap-2">
          <a href="/" onClick={(e) => { e.preventDefault(); onGoHome(); }} className="hover:text-white/70">Home</a>
          <span>/</span>
          <span className="text-white/70">Features</span>
          <span>/</span>
          <span className="text-white/90">Watch Party Online</span>
        </nav>

        <div className="mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-medium text-violet-300 mb-4">
            <Video className="w-3 h-3" />
            <span>Real-Time Group Collaboration</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-white leading-tight mb-5">
            Host an Online Watch Party With Friends
          </h1>
          <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-2xl">
            More than just a screen share. Talk, laugh, react, and watch together with zero video compression artifacts and crystal-clear voice and video calling.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Headphones className="w-5 h-5 text-indigo-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Integrated Audio Calling</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Low-latency voice calling powered by LiveKit WebRTC lets you react and chat simultaneously without needing Discord or external tools.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <Video className="w-5 h-5 text-purple-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Face-to-Face Video Grid</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              See your friends&apos; real reactions alongside the playback canvas with auto-resizing video participant tiles.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14]">
            <MessageSquare className="w-5 h-5 text-pink-400 mb-3" />
            <h2 className="text-sm font-semibold text-white mb-2">Live Chat & Reactions</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Express moments with instant chat bubbles and floating emoji bursts (❤️, 🔥, 😂, 👏, 🎉) that animate in sync.
            </p>
          </div>
        </div>

        {/* Informational Sections */}
        <article className="prose prose-invert max-w-none space-y-10 border-t border-white/[0.08] pt-12 text-sm text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-medium text-white mb-3">Why Discord Screen Share Ruins Watch Parties</h2>
            <p>
              Streaming high-definition video through typical screen-sharing tools crushes the framerate, introduces heavy macro-blocking compression, and frequently desynchronizes audio and video. Furthermore, it puts enormous upload bandwidth demands on the person streaming the screen.
            </p>
            <p className="mt-3">
              Resonance takes a fundamentally superior approach: every viewer streams directly from the source video at full resolution (up to 4K HDR), while Resonance sends lightweight synchronization packets (&lt;1 KB/s) to keep all participants aligned. The result is pristine video quality for everyone with zero lag.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-white mb-3">Moderation & Host Controls</h2>
            <p>
              When hosting a watch party, the room creator maintains full control over playback permissions, participant removal, and room security:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Authoritative Playback:</strong> The host controls Play, Pause, and Seeking so accidental clicks don&apos;t disrupt the party.</li>
              <li><strong>Room Passcodes:</strong> Keep parties private by enforcing a passcode before entry.</li>
              <li><strong>Host Role Transfer:</strong> Hand over the controls to any friend in the room with one click.</li>
            </ul>
          </section>
        </article>

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#10131c] to-[#0a0c10] text-center">
          <h2 className="text-xl sm:text-2xl font-medium text-white mb-2">Host your next watch party</h2>
          <p className="text-xs sm:text-sm text-white/50 max-w-md mx-auto mb-6">
            Free, instant, and private. Paste a link and bring everyone in.
          </p>
          <button
            onClick={onStartRoom}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer"
          >
            Create Watch Party Room
          </button>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Resonance. Online watch party platform.</p>
      </footer>
    </div>
  );
};

export default WatchPartyPage;
