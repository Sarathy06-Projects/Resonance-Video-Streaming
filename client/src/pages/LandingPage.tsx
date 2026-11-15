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
import { AuroraBackground } from '../components/AuroraBackground';

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

function YouTubeLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="17" y="3.5" rx="4.5" fill="#FF0000" />
      <polygon points="10,8 16,12 10,16" fill="white" />
    </svg>
  );
}

function VideoFileLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="4" fill="#0EA5E9" />
      <polygon points="10,8 16,12 10,16" fill="white" />
      <rect x="4.5" y="5" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.75" />
      <rect x="4.5" y="17" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.75" />
      <rect x="17.5" y="5" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.75" />
      <rect x="17.5" y="17" width="2" height="2" rx="0.5" fill="white" fillOpacity="0.75" />
    </svg>
  );
}

function HlsLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#10B981" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="2.5" fill="#10B981" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 5.5a9.2 9.2 0 0 0 0 13m13-13a9.2 9.2 0 0 1 0 13" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VimeoLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1AB7EA">
      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.24-6.026 6.36-8.29 6.36-1.409 0-2.578-1.299-3.516-3.899-.624-2.3-1.248-4.597-1.872-6.897-.694-2.332-1.442-3.498-2.247-3.498-.174 0-.78.364-1.819 1.092L0 7.408c1.178-1.04 2.334-2.078 3.468-3.118 1.562-1.386 2.709-2.115 3.44-2.184 1.838-.173 2.973 1.084 3.406 3.774.451 2.805.765 4.545.938 5.22.52 2.633 1.093 3.949 1.718 3.949.486 0 1.214-.694 2.185-2.083.971-1.388 1.492-2.446 1.561-3.176.139-1.214-.381-1.822-1.561-1.822-.555 0-1.127.121-1.717.364 1.144-3.743 3.33-5.548 6.557-5.413 2.429.07 3.593 1.637 3.488 4.5z" />
    </svg>
  );
}

function TwitchLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#9146FF">
      <path d="M2.149 0L.537 4.119v16.143h5.373v3.738h3.761l3.762-3.738h4.835L23.463 15.2V0H2.149zm19.164 14.134l-3.224 3.224h-5.373l-3.224 3.224v-3.224H4.836V2.149h16.477v11.985z"/>
      <path d="M17.552 5.91h-2.149v6.448h2.149V5.91zm-5.373 0h-2.149v6.448h2.149V5.91z"/>
    </svg>
  );
}

function GoogleDriveLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l6.1 10.5z" fill="#EA4335"/>
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D"/>
      <path d="m59.8 53-13.75-23.8-13.75 23.8h30.2c1.6 0 3.15-.45 4.5-1.2-.6-.35-1.15-.8-1.6-1.35-.45-.55-.85-1.15-1.15-1.85z" fill="#2684FC"/>
      <path d="M73.55 76.8H27.5L41.25 53h44.85c0 1.55-.4 3.1-1.2 4.5z" fill="#FFBA00"/>
    </svg>
  );
}

const supportedPlatforms = [
  { name: 'YouTube', icon: <YouTubeLogo className="w-4 h-4 flex-shrink-0" /> },
  { name: 'Direct MP4 / WebM', icon: <VideoFileLogo className="w-4 h-4 flex-shrink-0" /> },
  { name: 'HLS (.m3u8)', icon: <HlsLogo className="w-4 h-4 flex-shrink-0" /> },
  { name: 'Vimeo', icon: <VimeoLogo className="w-4 h-4 flex-shrink-0" /> },
  { name: 'Twitch', icon: <TwitchLogo className="w-4 h-4 flex-shrink-0" /> },
  { name: 'Google Drive', icon: <GoogleDriveLogo className="w-4 h-4 flex-shrink-0" /> },
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

  // Scroll detection for navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
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

      {/* ========================================================= */}
      {/* APPLE-INSPIRED FLOATING NAVIGATION                       */}
      {/* ========================================================= */}
      <header
        role="banner"
        className="fixed top-5 sm:top-6 inset-x-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none"
      >
        <motion.div
          initial={shouldReduceMotion ? false : { y: -16, opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`pointer-events-auto w-full max-w-fit md:min-w-[620px] lg:min-w-[680px] max-w-3xl h-12 rounded-full sm:rounded-[22px] border transition-all duration-300 ease-out px-3.5 sm:px-4.5 flex items-center justify-between gap-4 select-none ${
            scrolled
              ? 'bg-[#0a0c10]/85 border-white/[0.12] backdrop-blur-2xl shadow-[0_20px_40px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)]'
              : 'bg-[#0e1015]/70 border-white/[0.08] backdrop-blur-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]'
          }`}
        >
          {/* 1. Left: Resonance Logo & Wordmark */}
          <div className="flex items-center min-w-[120px] sm:min-w-[130px]">
            <a
              href="#top"
              className="flex items-center gap-2 group outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-full"
              aria-label="Resonance Home"
            >
              <div className="w-5.5 h-5.5 rounded-[7px] bg-white/[0.08] border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex items-center justify-center transition-colors group-hover:bg-white/[0.12]">
                <Play className="w-2.5 h-2.5 fill-white text-white ml-0.5" />
              </div>
              <span className="text-[13.5px] sm:text-[14px] font-medium tracking-[-0.025em] text-white">
                resonance
              </span>
            </a>
          </div>

          {/* 2. Center: Centered Navigation Links */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            className="hidden md:flex items-center justify-center gap-1 sm:gap-1.5"
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white/60 hover:text-white transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* 3. Right: Primary Start Room CTA & Mobile Menu Trigger */}
          <div className="flex items-center justify-end min-w-[120px] sm:min-w-[130px] gap-2">
            <button
              onClick={scrollToCreator}
              className="group h-7.5 px-3.5 sm:px-4 rounded-full bg-[#f4f4f6] hover:bg-white text-[#0a0a0c] text-[12px] sm:text-[12.5px] font-medium tracking-tight flex items-center gap-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.5)] transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>Start room</span>
              <ArrowRight className="w-3 h-3 text-[#0a0a0c]/70 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/[0.08] md:hidden transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <div className="w-4 h-3.5 flex flex-col justify-between items-center">
                <span
                  className={`w-3.5 h-0.5 bg-current rounded transition-all duration-200 ${
                    mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                  }`}
                />
                <span
                  className={`w-3.5 h-0.5 bg-current rounded transition-opacity duration-150 ${
                    mobileMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`w-3.5 h-0.5 bg-current rounded transition-all duration-200 ${
                    mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </motion.div>
      </header>

      {/* Floating Island Mobile Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-18 sm:top-20 inset-x-4 max-w-xs sm:max-w-sm mx-auto z-50 md:hidden rounded-2xl border border-white/[0.1] bg-[#0c0d12]/92 backdrop-blur-2xl p-3.5 shadow-[0_20px_40px_-6px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.12)] overflow-hidden"
          >
            <div className="flex flex-col gap-1 text-[13px]">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-2 mt-1 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    scrollToCreator();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#f4f4f6] text-[#0a0a0c] font-medium text-xs text-center shadow-md cursor-pointer hover:bg-white transition-colors"
                >
                  Start a room
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="top" className="relative z-10">
        {/* ========================================================= */}
        {/* HERO SECTION WITH SHADCN AURORA BACKGROUND                */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden border-b border-white/[0.06]">
          <AuroraBackground className="pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-24 xl:pt-32 xl:pb-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-14 items-center">
                {/* Left Column: Narrative, Headline, Trust Pillars & Platform Badges */}
                <div className="lg:col-span-7 text-left space-y-5 sm:space-y-6">
                  {/* Eyebrow Micro-Badge */}
                  <motion.div
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 14 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/70 tracking-wide"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Universal Playback Engine & Realtime Calling</span>
                  </motion.div>

                  {/* Main Statement Headline */}
                  <motion.h1
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                    className="text-3xl sm:text-5xl lg:text-[2.85rem] xl:text-[3.5rem] font-medium tracking-[-0.04em] leading-[1.08] text-white"
                  >
                    Your place to spend time together, even when you&apos;re apart.
                  </motion.h1>

                  {/* Subtitle */}
                  <motion.p
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
                    className="text-sm sm:text-base text-white/55 max-w-xl font-normal leading-relaxed"
                  >
                    From random discoveries to unforgettable movie nights, bring your favorite people together around any video in synchronized real-time.
                  </motion.p>

                  {/* Trust Highlights */}
                  <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/50">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Zero software installs</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sub-second playback lock</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                      <span>Free & instant join</span>
                    </span>
                  </div>
                </div>

                {/* Right Column: Room Creator Interface (Interactive Card) */}
                <motion.div
                  id="room-creator"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="lg:col-span-5 w-full"
                >
                  <div className="rounded-2xl border border-white/[0.09] bg-[#0c0e14]/90 p-5 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-left">
                    {/* Header of Card */}
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white">
                          <Play className="w-3 h-3 fill-white ml-0.2" />
                        </div>
                        <span className="text-xs font-semibold text-white tracking-tight">
                          Create Watch Room
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full font-medium">
                        Instant Setup
                      </span>
                    </div>

                    <form onSubmit={handleCreateRoom} className="space-y-3.5">
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
                            placeholder="Paste YouTube, MP4, HLS, Vimeo, Google Drive..."
                            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none pr-9 transition-colors"
                          />
                          <Link2 className="w-3.5 h-3.5 text-white/30 absolute right-3 pointer-events-none" />
                        </div>
                      </div>

                      {/* Live Video Preview Card */}
                      {previewInfo && (
                        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
                          <img
                            src={previewInfo.thumbnailUrl}
                            alt={previewInfo.title}
                            className="w-14 h-9 object-cover rounded-lg bg-black flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-white truncate">
                              {previewInfo.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
                              <span className="truncate">{previewInfo.authorName || 'Video Verified'}</span>
                              <span>•</span>
                              <span className="text-emerald-400 flex items-center gap-0.5 flex-shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Synced
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. Display Name Input */}
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

                      {/* 3. Password Toggle Switch */}
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                              isPrivate
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                                : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white/90">Require room password</p>
                            <p className="text-[10px] text-white/40 truncate">
                              {isPrivate ? 'Only users with passcode can enter' : 'Open to anyone with link'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPrivate}
                          onClick={() => {
                            setIsPrivate(!isPrivate);
                            if (isPrivate) setPasscode('');
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isPrivate ? 'bg-white' : 'bg-white/15 hover:bg-white/20'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out ${
                              isPrivate ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white/70'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Passcode Input Field (Revealed when toggle is active) */}
                      <AnimatePresence>
                        {isPrivate && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="pt-0.5">
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                                Room Passcode
                              </label>
                              <input
                                type="text"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                placeholder="Enter passcode..."
                                autoFocus
                                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/20 px-3.5 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {error && <p className="text-[11px] text-rose-400">{error}</p>}

                      {/* Primary Launch Action */}
                      <button
                        type="submit"
                        disabled={isCreating || isValidating}
                        className="w-full py-3 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-xs tracking-tight transition-all hover:scale-[1.008] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>{isCreating ? 'Creating Watch Room...' : 'Start a room with someone'}</span>
                      </button>
                    </form>

                    {/* Supported Streaming Sources Row at bottom of card */}
                    <div className="pt-4 mt-4 border-t border-white/[0.07]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-2.5">
                        Supported Streaming Sources
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {supportedPlatforms.map((p) => (
                          <div
                            key={p.name}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14] transition-all shadow-sm select-none"
                          >
                            {p.icon}
                            <span className="font-medium text-white/75 text-[11px] tracking-tight">
                              {p.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </AuroraBackground>
        </section>

        {/* ========================================================= */}
        {/* 03. PRODUCT SHOWCASE (Being apart doesn't mean missing out) */}
        {/* ========================================================= */}
        <section id="moments" className="px-4 py-24 sm:px-6 lg:px-8 border-t border-white/[0.06]">
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
