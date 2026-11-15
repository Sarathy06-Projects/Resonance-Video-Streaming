import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Link2,
  Copy,
  Check,
  Users,
  Sparkles,
  Shield,
  ChevronDown,
  ArrowRight,
  Share2,
  MessageSquare,
  Flame,
  Heart,
  Film,
  Radio,
  Globe,
  Phone,
  Video as VideoIcon,
  Mic,
  MicOff,
  Lock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { api } from '../services/api';
import { detectProviderQuick, PROVIDER_META, COMPATIBILITY_META } from '../utils/resolver';

interface LandingPageProps {
  onRoomCreated: (roomId: string, token: string, hostName: string) => void;
  onOpenPricing?: () => void;
}

const navItems = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Experience', href: '#experience' },
  { label: 'Moments', href: '#moments' },
  { label: 'FAQ', href: '#faq' },
];

const faqs = [
  {
    question: 'What is Resonance?',
    answer:
      'Resonance is a web-based shared watch experience where you can watch supported videos with friends in real time, complete with live chat, reactions, and integrated audio/video calling.',
  },
  {
    question: 'How does synchronized playback work?',
    answer:
      'Resonance coordinates playback events between participants using real-time WebSockets and low-latency coordinator state. When the host plays, pauses, or seeks, everyone stays in lockstep with sub-second drift compensation.',
  },
  {
    question: 'Do my friends need an account?',
    answer:
      'No. Guests can join directly using a room link and a display name without creating an account, downloading software, or installing browser extensions.',
  },
  {
    question: 'Which video providers are supported?',
    answer:
      'Resonance supports YouTube, direct MP4 and WebM files, HLS (.m3u8) live streams, Vimeo, Dailymotion, MPEG-DASH (.mpd), Twitch, Google Drive preview links, and embeddable web players.',
  },
  {
    question: 'Does Resonance host videos?',
    answer:
      'No. Resonance does not host, download, transcode, or redistribute videos. Videos are streamed directly from their respective providers or media hosts.',
  },
  {
    question: 'Does it support group video and audio calling?',
    answer:
      'Yes! Resonance includes integrated LiveKit calling so you can talk with audio or video with friends directly inside the watch room while streaming together.',
  },
] as const;

const supportedPlatforms = [
  { name: 'YouTube', type: 'Official IFrame' },
  { name: 'Direct MP4 / WebM', type: 'HTML5 Video' },
  { name: 'HLS (.m3u8)', type: 'Adaptive Stream' },
  { name: 'Vimeo', type: 'Player SDK' },
  { name: 'Twitch', type: 'Live Embed' },
  { name: 'Google Drive', type: 'Direct Preview' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onRoomCreated }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Link Module State
  const [videoUrl, setVideoUrl] = useState('');
  const [hostName, setHostName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [curatedDemos, setCuratedDemos] = useState<any[]>([]);

  // Scroll detection for navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch curated demos on load
  useEffect(() => {
    api
      .getCuratedDemos()
      .then((res) => {
        if (res && res.demos) setCuratedDemos(res.demos);
      })
      .catch(() => {});
  }, []);

  // Debounced URL validation
  useEffect(() => {
    if (!videoUrl.trim()) {
      setPreviewInfo(null);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      setError('');
      try {
        const res = await api.validateUrl(videoUrl.trim());
        if (res.valid) {
          setPreviewInfo(res.info);
        }
      } catch (err: any) {
        setPreviewInfo(null);
        setError(err.message || 'Invalid video link');
      } finally {
        setIsValidating(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setError('Please enter or select a video link');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const res = await api.createRoom({
        videoUrl: videoUrl.trim(),
        hostName: hostName.trim() || 'Alex',
        isPrivate,
        passcode: isPrivate ? passcode.trim() : undefined,
      });

      if (res.success && res.roomId && res.token) {
        localStorage.setItem(`together_token_${res.roomId}`, res.token);
        onRoomCreated(res.roomId, res.token, hostName.trim() || 'Alex');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const selectDemoVideo = (demo: any) => {
    const url =
      demo.url ||
      (demo.videoId?.startsWith('http')
        ? demo.videoId
        : `https://www.youtube.com/watch?v=${demo.videoId}`);
    setVideoUrl(url);
    setPreviewInfo({
      videoId: demo.videoId,
      title: demo.title,
      thumbnailUrl: demo.thumbnail,
      authorName: demo.channel,
      provider: demo.provider,
    });
  };

  const detected = detectProviderQuick(videoUrl);
  const activeMeta = detected ? PROVIDER_META[detected.provider] : null;

  const scrollToCreator = () => {
    const el = document.getElementById('room-creator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-[#f5f5f7] font-sans selection:bg-indigo-500/30 selection:text-white relative overflow-x-hidden">
      {/* Subtle Ambient Top Illumination */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.12),transparent_70%)] opacity-80" />
      </div>

      {/* Top Header Navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/[0.06] bg-[#07080a]/85 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Mark */}
          <a
            href="#top"
            className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-white group"
          >
            <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-sm group-hover:bg-white/15 transition-all">
              <Play className="w-3 h-3 fill-white ml-0.5" />
            </div>
            <span className="font-semibold tracking-[-0.03em]">resonance</span>
          </a>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-white/60">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Action Button */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={scrollToCreator}
              className="text-xs font-medium bg-white text-black hover:bg-white/90 px-3.5 py-1.5 rounded-full transition-all hover:scale-[1.02] shadow-sm flex items-center gap-1.5"
            >
              <span>Start room</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white md:hidden"
            aria-label="Toggle Navigation"
          >
            <div className="w-4 h-3 flex flex-col justify-between">
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
            </div>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/[0.06] bg-[#07080a]/95 backdrop-blur-2xl px-6 py-4 md:hidden overflow-hidden"
            >
              <div className="flex flex-col gap-3 text-sm text-white/70">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-1.5 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    scrollToCreator();
                  }}
                  className="mt-2 w-full py-2.5 rounded-xl bg-white text-black font-medium text-xs text-center"
                >
                  Start a room
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top" className="relative z-10">
        {/* ========================================================= */}
        {/* HERO SECTION                                              */}
        {/* ========================================================= */}
        <section className="px-4 pt-12 pb-20 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          {/* Eyebrow Micro-Badge */}
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 14 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/70 tracking-wide mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Universal Playback Engine & Realtime Calling</span>
          </motion.div>

          {/* Main Statement Headline */}
          <motion.h1
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="text-4xl sm:text-6xl lg:text-[4.75rem] font-medium tracking-[-0.045em] leading-[1.04] text-white max-w-4xl mx-auto"
          >
            Your place to spend time together, even when you&apos;re apart.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
            className="mt-6 text-base sm:text-lg text-white/55 max-w-2xl mx-auto font-normal leading-relaxed"
          >
            From random discoveries to unforgettable movie nights, bring your favorite people together around any video in synchronized real-time.
          </motion.p>

          {/* ========================================================= */}
          {/* ROOM CREATOR INTERFACE (Authentic Product Entry)         */}
          {/* ========================================================= */}
          <motion.div
            id="room-creator"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
            className="mt-10 max-w-xl mx-auto"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14]/90 p-5 sm:p-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-left">
              <form onSubmit={handleCreateRoom} className="space-y-4">
                {/* 1. Video URL Input with Auto-Detected Provider Pill */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      Video Link
                    </label>
                    {activeMeta && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/20 text-indigo-300">
                        {activeMeta.name} Detected
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Paste YouTube, MP4, HLS, Vimeo, Google Drive, Twitch..."
                      className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none pr-9 transition-colors"
                    />
                    <Link2 className="w-3.5 h-3.5 text-white/30 absolute right-3 pointer-events-none" />
                  </div>
                </div>

                {/* Live Video Preview Card */}
                {previewInfo && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
                    <img
                      src={previewInfo.thumbnailUrl}
                      alt={previewInfo.title}
                      className="w-16 h-10 object-cover rounded-lg bg-black flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">
                        {previewInfo.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                        <span>{previewInfo.authorName || 'Verified Video'}</span>
                        <span>•</span>
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Synchronizable
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Display Name & Passcode Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="Alex (Host)"
                      maxLength={30}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 px-3.5 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                        Room Security
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={`text-[10px] font-medium transition-colors ${
                          isPrivate ? 'text-indigo-400' : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {isPrivate ? 'Passcode Enabled' : 'Public Room'}
                      </button>
                    </div>
                    {isPrivate ? (
                      <input
                        type="text"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter room passcode..."
                        className="w-full rounded-xl bg-white/[0.04] border border-indigo-400/30 px-3.5 py-2 text-xs text-white placeholder-white/30 outline-none"
                      />
                    ) : (
                      <div
                        onClick={() => setIsPrivate(true)}
                        className="w-full rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] px-3.5 py-2 text-xs text-white/40 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span>Anyone with link can join</span>
                        <Lock className="w-3 h-3 text-white/30" />
                      </div>
                    )}
                  </div>
                </div>

                {error && <p className="text-[11px] text-rose-400">{error}</p>}

                {/* Primary Launch Action */}
                <button
                  type="submit"
                  disabled={isCreating || isValidating}
                  className="w-full py-3 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-xs tracking-tight transition-all hover:scale-[1.008] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>{isCreating ? 'Creating Watch Room...' : 'Start a room with someone'}</span>
                </button>
              </form>

              {/* Curated Demo Chips */}
              {curatedDemos.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    Or try a curated demonstration:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {curatedDemos.slice(0, 4).map((demo) => (
                      <button
                        key={demo.videoId}
                        onClick={() => selectDemoVideo(demo)}
                        className="text-[11px] text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <Play className="w-2.5 h-2.5 fill-white/60" />
                        <span>{demo.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Supported Platforms Micro-ticker */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-white/40">
              {supportedPlatforms.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{p.name}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ========================================================= */}
        {/* 03. PRODUCT SHOWCASE (Being apart doesn't mean missing out) */}
        {/* ========================================================= */}
        <section id="showcase" className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] text-white">
                Being apart doesn&apos;t mean missing out.
              </h2>
              <p className="mt-3.5 text-sm sm:text-base text-white/50 leading-relaxed">
                Different cities. Different time zones. Different rooms. Still, there&apos;s always something worth sharing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Movie Nights */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0e14] overflow-hidden flex flex-col hover:border-white/[0.14] transition-all">
                {/* Authentic Movie Night UI Frame */}
                <div className="aspect-[16/10] bg-black relative overflow-hidden flex items-center justify-center border-b border-white/[0.06]">
                  {/* High-res cinematic video preview mockup */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 z-10" />
                  <img
                    src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop"
                    alt="Movie frame"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                  />
                  {/* Floating Apple-style controls bar */}
                  <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between text-[10px] text-white/80 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 font-mono">
                    <div className="flex items-center gap-2">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>1:42:15 / 2:24:00</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white font-medium">4K HDR</span>
                  </div>
                  {/* Presence indicator */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>In Sync (Alex & Sarah)</span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                      Feature Length
                    </span>
                    <h3 className="text-xl font-medium tracking-tight text-white mt-1.5">
                      Movie nights
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed mt-2">
                      Your favourite movie moments, shared with your favourite people with zero audio lag and frame-locked playback.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Random Discoveries */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0e14] overflow-hidden flex flex-col hover:border-white/[0.14] transition-all">
                {/* Authentic UI Frame */}
                <div className="aspect-[16/10] bg-black relative overflow-hidden flex items-center justify-center border-b border-white/[0.06]">
                  <img
                    src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop"
                    alt="Video discovery"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 z-10" />

                  {/* Chat bubble overlay */}
                  <div className="absolute bottom-3 left-3 z-20 max-w-[85%] bg-[#12151c]/90 backdrop-blur-md border border-white/10 p-2.5 rounded-xl shadow-lg">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-0.5">
                      <span className="font-medium text-white/80">Maya</span>
                      <span>•</span>
                      <span>10:42 PM</span>
                    </div>
                    <p className="text-xs text-white font-medium">Wait for minute 2:15 😂🔥</p>
                  </div>

                  {/* Reaction badge */}
                  <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs text-white">
                    🔥 🍿 ❤️
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                      Discovery
                    </span>
                    <h3 className="text-xl font-medium tracking-tight text-white mt-1.5">
                      Random discoveries
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed mt-2">
                      That one video you just have to show everyone right now. Paste the link, send the invite, and watch together.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: A Little Closer */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0e14] overflow-hidden flex flex-col hover:border-white/[0.14] transition-all">
                {/* Authentic UI Frame */}
                <div className="aspect-[16/10] bg-black relative overflow-hidden flex items-center justify-center border-b border-white/[0.06]">
                  <img
                    src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop"
                    alt="Late night stream"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 z-10" />

                  {/* Live calling overlay */}
                  <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-[10px] text-indigo-300 font-semibold">
                        L
                      </div>
                      <div className="text-[10px]">
                        <p className="text-white font-medium">Leo (Speaking)</p>
                        <p className="text-emerald-400">Audio call active</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                      Connection
                    </span>
                    <h3 className="text-xl font-medium tracking-tight text-white mt-1.5">
                      A little closer
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed mt-2">
                      Make long-distance days feel a little less distant with integrated crystal-clear audio and video calling alongside your video.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 04. HOW IT WORKS (Three simple steps. One shared moment.) */}
        {/* ========================================================= */}
        <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] text-white">
                Three simple steps. One shared moment.
              </h2>
              <p className="mt-3.5 text-sm sm:text-base text-white/50 leading-relaxed">
                Getting everyone together shouldn&apos;t take more effort than finding something to watch.
              </p>
            </div>

            <div className="space-y-24">
              {/* Step 01 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      01
                    </span>
                    <span className="h-px w-8 bg-white/10" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                    Start with something worth sharing.
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">
                    Paste any link from YouTube, Vimeo, direct MP4 or WebM files, HLS live streams, Google Drive, or Twitch. Resonance instantly verifies the format and prepares synchronized controls.
                  </p>
                </div>

                {/* Authentic Step 01 Preview */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] text-[11px] text-white/40 font-mono">
                    <span>URL RESOLVER</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 text-left font-mono text-xs text-white/70 truncate">
                      https://youtube.com/watch?v=interstellar-trailer
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-white/40">FORMAT</p>
                      <p className="text-white font-medium mt-0.5">YouTube 4K</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-white/40">SYNC MODE</p>
                      <p className="text-emerald-400 font-medium mt-0.5">Sub-second</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-white/40">CONTROLS</p>
                      <p className="text-white font-medium mt-0.5">Authoritative</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 02 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="lg:order-2 text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      02
                    </span>
                    <span className="h-px w-8 bg-white/10" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                    One link brings everyone closer.
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">
                    Create your room in one click. Share the private invite link with friends. No account creation, app downloads, or browser extensions needed.
                  </p>
                </div>

                {/* Authentic Step 02 Preview */}
                <div className="lg:order-1 rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] text-[11px] text-white/40 font-mono">
                    <span>ROOM INVITATION</span>
                    <span className="text-white/70">ID: 5nn-m67</span>
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-mono text-white/80 truncate max-w-[200px]">
                      resonance.org.in/room/5nn-m67
                    </span>
                    <button className="text-[11px] font-medium bg-white text-black px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm">
                      <Copy className="w-3 h-3" />
                      <span>Copy Link</span>
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] text-white font-semibold">
                          A
                        </div>
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-[9px] text-white font-semibold">
                          S
                        </div>
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-semibold">
                          M
                        </div>
                      </div>
                      <span className="text-[11px]">3 people ready to watch</span>
                    </div>
                    <span className="text-emerald-400 text-[11px]">Room unlocked</span>
                  </div>
                </div>
              </div>

              {/* Step 03 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      03
                    </span>
                    <span className="h-px w-8 bg-white/10" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                    The moment starts when everyone joins.
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">
                    Watch together in lockstep. Play, pause, or seek with automatic drift correction, live text chat, floating reactions, and crisp WebRTC group calling.
                  </p>
                </div>

                {/* Authentic Step 03 Preview */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] text-[11px] text-white/40 font-mono">
                    <span>LIVE WATCH PARTY</span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      In Sync
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl aspect-video bg-black relative overflow-hidden flex items-center justify-center border border-white/[0.06]">
                    <img
                      src="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=800&auto=format&fit=crop"
                      alt="Synced scene"
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[10px] text-white/80 font-mono">
                      <span>04:18 / 16:40</span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span>❤️</span>
                        <span>🔥</span>
                        <span>👏</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-white/50">
                    <span>Host: Alex</span>
                    <span className="text-indigo-400">Drift Compensation: Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 05. SHARED EXPERIENCE (More than a screen. A shared exp.) */}
        {/* ========================================================= */}
        <section id="experience" className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] text-white">
                More than a screen. A shared experience.
              </h2>
              <p className="mt-3.5 text-sm sm:text-base text-white/50 leading-relaxed">
                Your video, your people, and your conversations — all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: In Sync */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-6 flex flex-col justify-between text-left">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 mb-5">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    IN SYNC
                  </span>
                  <h3 className="text-xl font-medium text-white tracking-tight mt-1">
                    Everyone stays on the same moment.
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed mt-2.5">
                    Playback stays synchronized across all viewers with sub-second drift correction, so nobody has to ask where everyone is.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Drift tolerance: ±0.35s</span>
                </div>
              </div>

              {/* Feature 2: Presence & Calling */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-6 flex flex-col justify-between text-left">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-5">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    YOUR PEOPLE, RIGHT THERE
                  </span>
                  <h3 className="text-xl font-medium text-white tracking-tight mt-1">
                    See who is sharing the moment.
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed mt-2.5">
                    Know who is in the room and enjoy crystal-clear audio and video calling powered by LiveKit WebRTC.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] text-[10px] font-mono text-indigo-400 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  <span>LiveKit Group Calling Enabled</span>
                </div>
              </div>

              {/* Feature 3: Conversation */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e14] p-6 flex flex-col justify-between text-left">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center text-violet-400 mb-5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    CONVERSATION
                  </span>
                  <h3 className="text-xl font-medium text-white tracking-tight mt-1">
                    Keep the conversation close.
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed mt-2.5">
                    React, chat, laugh, and share your thoughts in realtime with dedicated sound chimes and floating reactions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] text-[10px] font-mono text-white/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Realtime Reactions Dock</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 06. SIMPLICITY SECTION (Together, without the complicated)*/}
        {/* ========================================================= */}
        <section className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] text-white">
                Together, without the complicated.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-xs font-mono font-semibold text-indigo-400 mb-4">01</div>
                <h3 className="text-lg font-medium text-white">Nothing to install.</h3>
                <p className="mt-2 text-xs text-white/50 leading-relaxed">
                  Open Resonance in your browser and start instantly. No extensions, accounts, or complex software.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-xs font-mono font-semibold text-indigo-400 mb-4">02</div>
                <h3 className="text-lg font-medium text-white">Easy to invite.</h3>
                <p className="mt-2 text-xs text-white/50 leading-relaxed">
                  One shareable room link brings everyone in with zero friction. Works seamlessly across desktop and mobile.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-xs font-mono font-semibold text-indigo-400 mb-4">03</div>
                <h3 className="text-lg font-medium text-white">Made for shared moments.</h3>
                <p className="mt-2 text-xs text-white/50 leading-relaxed">
                  Synchronized video, live chat, floating reactions, and group calling unified in one clean interface.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 08. FAQ SECTION (Questions before your first watch?)       */}
        {/* ========================================================= */}
        <section id="faq" className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.04em] text-white">
                Questions before your first watch?
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <FaqAccordionItem key={faq.question} faq={faq} defaultOpen={index === 0} />
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 09. FINAL CTA (There's always room for one more.)         */}
        {/* ========================================================= */}
        <section className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
          <div className="max-w-4xl mx-auto rounded-3xl border border-white/[0.08] bg-[#0c0e14] p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%)] pointer-events-none" />

            <h2 className="text-3xl sm:text-5xl font-medium tracking-[-0.04em] text-white relative z-10">
              There&apos;s always room for one more.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/55 max-w-xl mx-auto relative z-10 leading-relaxed">
              Find something worth watching. Invite your people. Make a moment out of it.
            </p>

            <div className="mt-8 relative z-10">
              <button
                onClick={scrollToCreator}
                className="px-6 py-3 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-xs tracking-tight transition-all hover:scale-[1.02] shadow-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Start your first room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <p className="mt-3 text-[11px] text-white/40">Free to get started. No download required.</p>
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 relative z-10">
              <div className="flex -space-x-1.5">
                {['A', 'M', 'J', 'S'].map((avatar, i) => (
                  <div
                    key={avatar}
                    className="w-7 h-7 rounded-full bg-indigo-500/20 border border-white/10 flex items-center justify-center text-[10px] text-white font-medium"
                  >
                    {avatar}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-white/40">
                Watching together • In lockstep
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 10. FOOTER                                                */}
      {/* ========================================================= */}
      <footer className="border-t border-white/[0.06] bg-[#07080a] py-12 px-4 sm:px-6 lg:px-8 text-xs text-white/40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-white">
              <Play className="w-2.5 h-2.5 fill-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">resonance</span>
            <span className="text-white/20">|</span>
            <span>Universal Playback Engine</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-white/50">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="hover:text-white transition-colors">
                {item.label}
              </a>
            ))}
            <a href="#faq" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>

          <div>© 2026 Resonance • Powered by Neon PostgreSQL</div>
        </div>
      </footer>
    </div>
  );
};

function FaqAccordionItem({
  faq,
  defaultOpen,
}: {
  faq: { question: string; answer: string };
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0e14] overflow-hidden text-left transition-colors hover:border-white/[0.1]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left text-sm font-medium text-white/90 hover:text-white transition-colors"
      >
        <span>{faq.question}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-xs text-white/55 leading-relaxed border-t border-white/[0.04] pt-3">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LandingPage;
