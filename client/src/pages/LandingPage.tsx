import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Copy,
  Globe2,
  Link2,
  MonitorPlay,
  Play,
  Users,
  Wifi,
  CheckCircle2,
  Lock,
  Sparkles,
  Database,
  Radio,
} from 'lucide-react';
import GradientASCII from '../components/GradientASCII';
import { api } from '../services/api';
import { detectProviderQuick, PROVIDER_META, COMPATIBILITY_META } from '../utils/resolver';

interface LandingPageProps {
  onRoomCreated: (roomId: string, token: string, hostName: string) => void;
  onOpenPricing?: () => void;
}

const navItems = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Experience', href: '#experience' },
  { label: 'FAQ', href: '#faq' },
];

const storyScenes = [
  {
    title: 'Bedroom night',
    text: 'A quiet room, one shared screen, and a little bit of distance closing in.',
    tone: 'from-violet-500/25 via-[#14171d] to-[#08090b]',
    accent: 'bg-violet-400/20',
  },
  {
    title: 'Different places, same story',
    text: 'Two friends in different corners of the day, still finding the same moment.',
    tone: 'from-[#14171d] via-[#1a1d24] to-[#08090b]',
    accent: 'bg-cyan-400/20',
  },
  {
    title: 'Movie night, no matter the miles',
    text: 'A couple settles in with the same frame, the same reaction, the same laughter.',
    tone: 'from-[#14171d] via-violet-500/20 to-[#08090b]',
    accent: 'bg-amber-400/20',
  },
];

const steps = [
  {
    number: '01',
    title: 'Start with something worth sharing.',
    description: 'Find a video you love (YouTube, Vimeo, MP4, HLS, Google Drive, Twitch) and bring it to Resonance.',
    label: 'CONCEPTUAL PRODUCT PREVIEW',
    kind: 'link',
  },
  {
    number: '02',
    title: 'One link brings everyone closer.',
    description: 'Create a room and invite your friends with a simple shareable link.',
    label: 'CONCEPTUAL PRODUCT PREVIEW',
    kind: 'invite',
  },
  {
    number: '03',
    title: 'The moment starts when everyone joins.',
    description: 'Watch together, chat, react, and enjoy synchronized playback and calling without being in the same place.',
    label: 'CONCEPTUAL PRODUCT PREVIEW',
    kind: 'watch',
  },
] as const;

const experiences = [
  {
    eyebrow: 'IN SYNC',
    title: 'Everyone stays on the same moment.',
    description: 'Playback stays synchronized, so nobody has to ask where everyone is.',
  },
  {
    eyebrow: 'YOUR PEOPLE, RIGHT THERE',
    title: 'See who is sharing the moment.',
    description: 'Know who is in the room and enjoy the little reactions and calling that make watching together special.',
  },
  {
    eyebrow: 'THE CONVERSATION CONTINUES',
    title: 'Keep the conversation close.',
    description: 'React, chat, laugh, and share your thoughts without leaving the room.',
  },
] as const;

const moments = [
  {
    title: 'Movie nights',
    text: 'Your favourite movie moments, shared with your favourite people.',
    tone: 'from-[#1a1b20] via-[#262833] to-[#111319]',
  },
  {
    title: 'Random discoveries',
    text: 'That one video you just have to show everyone.',
    tone: 'from-[#221d2b] via-[#17141f] to-[#0c0d12]',
  },
  {
    title: 'A little closer',
    text: 'Make long-distance days feel a little less distant.',
    tone: 'from-[#272118] via-[#201d16] to-[#0d0d0b]',
  },
] as const;

const benefits = [
  {
    title: 'Nothing to install',
    description: 'Open Resonance in your browser and start instantly.',
    icon: Globe2,
  },
  {
    title: 'Easy to invite',
    description: 'Share a room link and bring everyone in with zero hassle.',
    icon: Link2,
  },
  {
    title: 'Made for shared moments',
    description: 'Enjoy synchronized video, live chat, reactions, and calling in one space.',
    icon: Users,
  },
] as const;

const faqs = [
  {
    question: 'What is Resonance?',
    answer:
      'Resonance is a web-based shared watch experience where you can watch supported videos with friends in real time, complete with live chat and calling.',
  },
  {
    question: 'How does synchronized playback work?',
    answer:
      'Resonance coordinates playback events between participants using real-time WebSockets and low-latency coordinator state. When the host plays, pauses, or seeks, everyone stays in lockstep.',
  },
  {
    question: 'Do my friends need an account?',
    answer:
      'No. Guests can join directly using a room link and a display name without creating an account.',
  },
  {
    question: 'Which video providers are supported?',
    answer:
      'Resonance supports YouTube, direct MP4 and WebM files, HLS (.m3u8) live streams, Vimeo, Dailymotion, MPEG-DASH (.mpd), Twitch, Google Drive videos, and embeddable web players.',
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

export const LandingPage: React.FC<LandingPageProps> = ({ onRoomCreated }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    }, 400);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setError('Please paste a video link');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const res = await api.createRoom({
        videoUrl: videoUrl.trim(),
        hostName: hostName.trim() || 'Host',
        isPrivate,
        passcode: isPrivate ? passcode.trim() : undefined,
      });

      if (res.success && res.roomId && res.token) {
        localStorage.setItem(`together_token_${res.roomId}`, res.token);
        onRoomCreated(res.roomId, res.token, hostName.trim() || 'Host');
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
    <div className="min-h-screen bg-[#08090b] text-[#f5f5f7]">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 opacity-50 z-0">
        <div className="ambient-spot ambient-spot--one" />
        <div className="ambient-spot ambient-spot--two" />
      </div>

      {/* Navigation Header */}
      <header
        className={[
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-white/10 bg-[#0d0f13]/85 backdrop-blur-xl'
            : 'bg-transparent',
        ].join(' ')}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-[1.5rem] font-medium tracking-[-0.08em] text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#8b5cf6] to-[#38bdf8] text-xs font-bold text-white shadow-md shadow-[#8b5cf6]/30">
              <Play size={14} className="fill-white ml-0.5" />
            </span>
            <span>resonance</span>
          </a>

          <div className="hidden items-center gap-8 text-sm text-[#dfe3ea] md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-white/75 transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={scrollToCreator}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 hover:shadow-lg hover:shadow-white/5"
            >
              Start a room
            </button>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-white" />
              <span className="block h-0.5 w-5 rounded-full bg-white" />
              <span className="block h-0.5 w-5 rounded-full bg-white" />
            </span>
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0d0f13]/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-base text-white/75">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-2"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToCreator();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-white"
                >
                  Start a room
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="pointer-events-none absolute inset-0 opacity-95">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(118,90,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_28%)]" />
            <div className="absolute inset-x-0 top-0 mx-auto h-[34rem] w-full max-w-6xl">
              <GradientASCII
                colors={['#7c3aed', '#60a5fa', '#dbeafe', '#f5f3ff']}
                shape="horizon"
                cellSize={16}
                density={0.82}
                glyphOpacity={0.78}
                gradientOpacity={1}
                glow={0.85}
                softness={0.52}
                flow={0.82}
                speed={0.72}
                grain={0.08}
                scrambleRadius={0.2}
                className="hero-gradient-ascii"
                style={{ borderRadius: '1.75rem' }}
              />
            </div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="mx-auto max-w-4xl text-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#b5b8c0] shadow-sm mb-4">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Synchronized Video Platform • Powered by Neon PostgreSQL</span>
              </div>

              <h1 className="mt-2 text-4xl font-medium tracking-[-0.07em] text-white sm:text-6xl lg:text-[5.3rem] lg:leading-[0.96]">
                Your place to spend time together, even when you&apos;re apart.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-[#b6bac3] sm:text-lg">
                From random videos to unforgettable movie nights, make room for the moments you want to share in synchronized real-time.
              </p>
            </motion.div>

            {/* Our Link Module: Core Room Creation Box */}
            <motion.div
              id="room-creator"
              initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 20 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
              className="relative mx-auto mt-12 max-w-2xl"
            >
              <div className="rounded-[2rem] border border-white/10 bg-[#0d0f13]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  {/* Video URL Input */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#d0d4dc]">
                        1. Paste Video Link
                      </label>
                      {activeMeta && (
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${activeMeta.badgeBg}`}
                        >
                          {activeMeta.name}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="Paste link: YouTube, MP4, HLS (.m3u8), Vimeo, Dailymotion, Twitch, Google Drive..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-[#a394ff] focus:ring-1 focus:ring-[#a394ff]/40 pr-10"
                      />
                      <Link2 className="w-4 h-4 text-white/40 absolute right-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Video Preview Card */}
                  {previewInfo && (
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={previewInfo.thumbnailUrl}
                          alt={previewInfo.title}
                          className="w-20 h-12 object-cover rounded-lg bg-black/40 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-white truncate">
                            {previewInfo.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[11px] text-[#a0a6b5] truncate">
                              {previewInfo.authorName}
                            </p>
                            {previewInfo.provider && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#a394ff]/20 text-[#d8d0ff] uppercase font-mono">
                                {previewInfo.provider}
                              </span>
                            )}
                          </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mr-1" />
                      </div>

                      {/* Compatibility Status Pill */}
                      {detected && COMPATIBILITY_META[detected.compatibility] && (
                        <div className="pt-2 border-t border-white/10 flex items-start gap-2 text-left">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${COMPATIBILITY_META[detected.compatibility].badgeClass}`}
                          >
                            {COMPATIBILITY_META[detected.compatibility].label}
                          </span>
                          <p className="text-[11px] text-[#c0c5d0] leading-tight">
                            {previewInfo.explanation ||
                              COMPATIBILITY_META[detected.compatibility].description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Display Name Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#d0d4dc] mb-2 text-left">
                      2. Your Display Name
                    </label>
                    <input
                      type="text"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="e.g. Alex (Host)"
                      maxLength={30}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-[#a394ff] focus:ring-1 focus:ring-[#a394ff]/40"
                    />
                  </div>

                  {/* Privacy Toggle */}
                  <div className="pt-1 text-left">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-4 h-4 rounded bg-white/10 border-white/20 text-[#a394ff] focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-xs text-[#d0d4dc] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-white/50" /> Make Room Private (Passcode Protected)
                      </span>
                    </label>

                    {isPrivate && (
                      <div className="mt-2.5">
                        <input
                          type="text"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          placeholder="Enter room passcode (e.g. watch123)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-[#a394ff]"
                        />
                      </div>
                    )}
                  </div>

                  {error && <p className="text-xs text-rose-400 text-left">{error}</p>}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isCreating || isValidating}
                    className="w-full py-3.5 rounded-full bg-[#a394ff] hover:bg-[#b8abff] text-[#0b0d12] font-semibold text-sm shadow-lg shadow-[#a394ff]/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-[#0b0d12]" />
                    <span>{isCreating ? 'Creating Watch Room...' : 'Create Watch Room & Start'}</span>
                  </button>
                </form>

                {/* Quick Demo Pickers */}
                {curatedDemos.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-white/10 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#989fad] mb-2.5">
                      Or pick a quick demo video to test:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {curatedDemos.map((demo) => (
                        <button
                          key={demo.videoId}
                          onClick={() => selectDemoVideo(demo)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-left transition-colors group"
                        >
                          <img
                            src={demo.thumbnail}
                            alt={demo.title}
                            className="w-9 h-7 object-cover rounded bg-black/40 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-white/90 group-hover:text-white truncate">
                              {demo.title}
                            </p>
                            <p className="text-[9px] text-[#939baa] truncate">{demo.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Story Section */}
        <section id="story" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                Being apart doesn&apos;t mean missing out.
              </h2>
              <p className="mt-5 text-lg text-[#b4b9c2]">
                Different cities. Different time zones. Different rooms. Still, there&apos;s always something worth sharing.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {storyScenes.map((scene, index) => (
                <motion.article
                  key={scene.title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 26 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.7, delay: index * 0.1 }}
                  className="story-scene overflow-hidden rounded-[2rem] border border-white/8 bg-[#0d0f13]"
                >
                  <div className={`story-scene__art ${scene.tone}`}>
                    <div className="story-scene__glow" />
                    <div className={`story-scene__orb ${scene.accent}`} />
                    <div className="story-scene__person story-scene__person--left" />
                    <div className="story-scene__person story-scene__person--right" />
                    <div className="story-scene__screen" />
                  </div>
                  <div className="space-y-3 p-6 text-left">
                    <span className="text-[0.7rem] uppercase tracking-[0.26em] text-[#a394ff]">
                      {scene.title}
                    </span>
                    <p className="text-base leading-7 text-[#dfe5ed]">{scene.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                Three simple steps. One shared moment.
              </h2>
              <p className="mt-5 text-lg text-[#b4b9c2]">
                Getting everyone together shouldn&apos;t take more effort than finding something to watch.
              </p>
            </motion.div>

            <div className="mt-14 space-y-12">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.7, delay: index * 0.08 }}
                  className="grid items-center gap-8 lg:grid-cols-[1.1fr_1.2fr]"
                >
                  <div className={index % 2 === 1 ? 'lg:order-2 text-left' : 'text-left'}>
                    <div className="mb-5 flex items-center gap-3 text-sm uppercase tracking-[0.18em] text-[#a394ff]">
                      <span>{step.number}</span>
                      <span className="h-px w-12 bg-white/20" />
                    </div>
                    <h3 className="text-3xl font-medium tracking-[-0.06em] text-white sm:text-4xl">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-lg text-[#b6bac4]">{step.description}</p>
                  </div>

                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    {step.kind === 'link' && <VideoInputPreview />}
                    {step.kind === 'invite' && <RoomInvitePreview />}
                    {step.kind === 'watch' && <WatchRoomPreview />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Experience Section */}
        <section id="experience" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                More than a screen. A shared experience.
              </h2>
              <p className="mt-5 text-lg text-[#b4b9c2]">
                Your video, your people, and your conversations — all in one place.
              </p>
            </motion.div>

            <div className="mt-12 space-y-8">
              {experiences.map((experience, index) => (
                <motion.div
                  key={experience.title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.7, delay: index * 0.08 }}
                  className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#0d0f13] p-5 sm:p-7"
                >
                  <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.4rem] border border-white/8 bg-[#10141b] p-3 sm:p-4">
                      <ExperiencePreview index={index} />
                    </div>
                    <div className="text-left">
                      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#b8bbcf]">
                        {experience.eyebrow}
                      </p>
                      <h3 className="mt-4 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
                        {experience.title}
                      </h3>
                      <p className="mt-4 text-base leading-7 text-[#b8bdc8]">
                        {experience.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Moments Section */}
        <section id="moments" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="mb-10 max-w-3xl text-left"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                Made for the moments you don&apos;t want to keep to yourself.
              </h2>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              {moments.map((moment, index) => (
                <motion.article
                  key={moment.title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 25 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.7, delay: index * 0.08 }}
                  className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#0d0f13]"
                >
                  <div className={`relative h-80 bg-gradient-to-br ${moment.tone}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(163,148,255,0.2),_transparent_35%),linear-gradient(180deg,transparent,rgba(8,9,11,0.5))]" />
                    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                      <div className="flex -space-x-2">
                        {['A', 'M', 'S'].map((avatar, avatarIndex) => (
                          <div
                            key={avatar}
                            className={[
                              'flex h-10 w-10 items-center justify-center rounded-full border border-[#0d0f13] text-[0.7rem] font-medium text-white',
                              avatarIndex === 0
                                ? 'bg-[#8d7ae8]'
                                : avatarIndex === 1
                                ? 'bg-[#d9c4ff] text-[#191b25]'
                                : 'bg-[#5b6477]',
                            ].join(' ')}
                          >
                            {avatar}
                          </div>
                        ))}
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-white/80">
                        {index === 0 ? 'MOVIE NIGHT' : index === 1 ? 'DISCOVERY' : 'LATE NIGHT'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 p-6 text-left">
                    <h3 className="text-2xl font-medium tracking-[-0.05em] text-white">
                      {moment.title}
                    </h3>
                    <p className="text-base leading-7 text-[#c0c4ce]">{moment.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                Together, without the complicated.
              </h2>
            </motion.div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {benefits.map(({ title, description, icon: Icon }, index) => (
                <motion.div
                  key={title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 22 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, delay: index * 0.08 }}
                  className="rounded-[1.6rem] border border-white/8 bg-[#0d0f13] p-6 text-left"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#a394ff]/35 bg-[#a394ff]/10 text-[#d8d0ff]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-2xl font-medium tracking-[-0.05em] text-white">{title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#bbbfca]">{description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="text-center"
            >
              <h2 className="text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl">
                Questions before your first watch?
              </h2>
            </motion.div>

            <div className="mt-10 space-y-4">
              {faqs.map((item, index) => (
                <motion.div
                  key={item.question}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
                  whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: index * 0.04 }}
                  className="overflow-hidden rounded-[1.3rem] border border-white/8 bg-[#0d0f13]"
                >
                  <FaqItem item={item} defaultOpen={index === 0} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="px-4 pb-24 pt-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.2rem] border border-white/8 bg-[#0c0f13] px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="relative overflow-hidden rounded-[1.8rem] border border-white/6 bg-black/40 px-6 py-12 text-center sm:px-10 lg:px-14"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(163,148,255,0.24),_transparent_38%)]" />
              <div className="relative">
                <h2 className="mx-auto max-w-4xl text-4xl font-medium tracking-[-0.07em] text-white sm:text-5xl lg:text-[4.2rem] lg:leading-[0.95]">
                  There&apos;s always room for one more.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg text-[#c0c4cc]">
                  Find something worth watching. Invite your people. Make a moment out of it.
                </p>
                <button
                  onClick={scrollToCreator}
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#a394ff] px-7 py-3.5 text-base font-semibold text-[#0b0d12] transition hover:bg-[#baa9ff] hover:shadow-lg hover:shadow-[#a394ff]/25"
                >
                  Start your first room <ArrowRight size={16} />
                </button>
                <p className="mt-4 text-sm text-[#9ba0aa]">Free to get started. No download required.</p>
              </div>

              <div className="relative mt-10 flex items-center justify-center gap-4">
                {['A', 'M', 'J', 'S'].map((avatar, i) => (
                  <div
                    key={avatar}
                    className={[
                      'flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-sm font-medium text-white',
                      i === 0
                        ? 'bg-[#9f8cff]'
                        : i === 1
                        ? 'bg-[#d8d0ff] text-[#171a22]'
                        : i === 2
                        ? 'bg-[#6d7587]'
                        : 'bg-[#2f3645]',
                    ].join(' ')}
                  >
                    {avatar}
                  </div>
                ))}
                <div className="ml-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] text-[#dfe3eb]">
                  <MonitorPlay size={14} />
                  WATCHING TOGETHER
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#090b0e] px-4 py-10 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between text-left">
          <div>
            <div className="flex items-center gap-2 text-[1.6rem] font-medium tracking-[-0.08em] text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#a394ff] text-xs font-bold text-[#0b0d12]">
                <Play size={12} className="fill-[#0b0d12] ml-0.5" />
              </span>
              <span>resonance</span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#98a0ab]">
              Your place to spend time together, even when you&apos;re apart.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#dfe3eb]">
            {['How it works', 'Experience', 'FAQ', 'About', 'Privacy', 'Terms', 'Contact'].map(
              (label) => (
                <a
                  key={label}
                  href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
                  className="transition hover:text-white"
                >
                  {label}
                </a>
              )
            )}
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-6 text-sm text-[#8d94a1] text-left">
          © 2026 Resonance • Serverless Social Video Platform • Powered by Neon PostgreSQL
        </div>
      </footer>
    </div>
  );
};

/* Preview Illustrations from Resonance Video Site */

function VideoInputPreview() {
  return (
    <div className="feature-illustration text-left">
      <div className="feature-illustration__header">CONCEPTUAL PRODUCT PREVIEW</div>
      <div className="feature-illustration__linkbox">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#dfe3eb]">
            <Link2 size={15} />
          </div>
          <div className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-[#c7ccd4]">
            https://www.youtube.com/watch?v=...
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.2rem] border border-white/8 bg-[#171b23] p-3">
          <div className="relative h-36 overflow-hidden rounded-[0.9rem] bg-[radial-gradient(circle_at_30%_20%,rgba(161,148,255,0.35),transparent_22%),radial-gradient(circle_at_70%_30%,rgba(132,165,255,0.25),transparent_18%),linear-gradient(135deg,#1d2534,#0e1119_65%)]">
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0d12] to-transparent" />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white/70">
              <Play size={10} />
              YouTube
            </div>
          </div>
        </div>
        <div className="rounded-[1.2rem] border border-white/8 bg-[#0f1118] p-4">
          <div className="mb-3 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.22em] text-[#aeb5c2]">
            <span>Ready</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">
              Live
            </span>
          </div>
          <div className="space-y-3">
            <div className="h-2.5 w-2/3 rounded-full bg-white/10" />
            <div className="h-2.5 w-1/2 rounded-full bg-white/8" />
            <div className="h-2.5 w-3/4 rounded-full bg-white/8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomInvitePreview() {
  return (
    <div className="feature-illustration text-left">
      <div className="feature-illustration__header">CONCEPTUAL PRODUCT PREVIEW</div>
      <div className="rounded-[1.2rem] border border-white/8 bg-[#11161d] p-5">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-[#0c0f14] px-4 py-3 text-sm text-[#dfe4ed]">
          <span className="max-w-[14rem] truncate text-ellipsis">resonance.app/room/afternoon-garden</span>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/80">
            <Copy size={12} />
            Copy link
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex -space-x-2">
            {['A', 'M', 'J'].map((avatar, index) => (
              <div
                key={avatar}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border border-[#0f1318] text-[0.62rem] font-medium text-white',
                  index === 0
                    ? 'bg-[#9388f2]'
                    : index === 1
                    ? 'bg-[#d7d3ff] text-[#171c26]'
                    : 'bg-[#6a7284]',
                ].join(' ')}
              >
                {avatar}
              </div>
            ))}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/70">
            Your room is ready.
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchRoomPreview() {
  return (
    <div className="feature-illustration text-left">
      <div className="feature-illustration__header">CONCEPTUAL PRODUCT PREVIEW</div>
      <div className="rounded-[1.4rem] border border-white/8 bg-[#10151d] p-3">
        <div className="overflow-hidden rounded-[1rem] border border-white/8 bg-[#121822]">
          <div className="relative h-52 bg-[radial-gradient(circle_at_40%_30%,rgba(184,160,255,0.28),transparent_22%),linear-gradient(135deg,#1d2635,#0d1117_70%)]">
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#090b12] to-transparent" />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-white/80">
              <Play size={9} />
              Live
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between text-[0.68rem] uppercase tracking-[0.22em] text-[#adbac9]">
              <span>Room sync</span>
              <span className="rounded-full border border-emerald-400/35 bg-emerald-400/8 px-2 py-1 text-emerald-300">
                Stable
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/10">
              <div className="h-full w-[62%] rounded-full bg-[#a394ff]" />
            </div>
            <div className="flex items-center justify-between text-sm text-[#dfe4ee]">
              <span>Alex</span>
              <span>Maya</span>
              <span>Jordan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperiencePreview({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="rounded-[1.1rem] border border-white/8 bg-[#0f141c] p-3 text-left">
          <div className="relative overflow-hidden rounded-[0.9rem] bg-[radial-gradient(circle_at_30%_20%,rgba(163,148,255,0.28),transparent_22%),linear-gradient(135deg,#18202d,#0a0f16_68%)] p-3">
            <div className="mb-4 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.22em] text-[#acb7c6]">
              <span>Now playing</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/80">
                Sync 99%
              </span>
            </div>
            <div className="h-40 rounded-[0.8rem] bg-[linear-gradient(180deg,rgba(18,24,32,0.2),rgba(4,7,11,0.7)),radial-gradient(circle_at_70%_35%,rgba(129,157,255,0.4),transparent_18%)]" />
            <div className="mt-4 flex items-center justify-between text-xs text-[#dfe4ee]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#a394ff] text-[#0b0d12]">
                  <Play size={10} />
                </div>
                <span>Playing together</span>
              </div>
              <div className="flex -space-x-2">
                {['A', 'M', 'J', 'S'].map((avatar, personIndex) => (
                  <div
                    key={avatar}
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full border border-[#11161d] text-[0.56rem] font-medium text-white',
                      personIndex === 0
                        ? 'bg-[#9a8ef4]'
                        : personIndex === 1
                        ? 'bg-[#d8ccff] text-[#171b22]'
                        : personIndex === 2
                        ? 'bg-[#6281a7]'
                        : 'bg-[#39485f]',
                    ].join(' ')}
                  >
                    {avatar}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    case 1:
      return (
        <div className="rounded-[1.1rem] border border-white/8 bg-[#0f141c] p-3 text-left">
          <div className="rounded-[0.9rem] border border-white/8 bg-[#111926] p-3">
            <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.2em] text-[#aeb8c5]">
              <span>In the room</span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                Active
              </span>
            </div>
            <div className="mt-5 flex gap-3 overflow-hidden">
              {['A', 'M', 'J', 'S', 'L'].map((avatar, personIndex) => (
                <div key={avatar} className="flex flex-col items-center gap-2">
                  <div
                    className={[
                      'flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium text-white',
                      personIndex === 0
                        ? 'bg-[#9a8ef4]'
                        : personIndex === 1
                        ? 'bg-[#d8ccff] text-[#171b22]'
                        : personIndex === 2
                        ? 'bg-[#5d7ea8]'
                        : personIndex === 3
                        ? 'bg-[#7e6d9a]'
                        : 'bg-[#50617b]',
                    ].join(' ')}
                  >
                    {avatar}
                  </div>
                  <span className="text-[0.7rem] text-[#c5ccd7]">
                    {personIndex === 0
                      ? 'Alex'
                      : personIndex === 1
                      ? 'Maya'
                      : personIndex === 2
                      ? 'Jordan'
                      : personIndex === 3
                      ? 'Sam'
                      : 'Lee'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between text-2xl">
              <span>😊</span>
              <span>🔥</span>
              <span>😂</span>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="rounded-[1.1rem] border border-white/8 bg-[#0f141c] p-3 text-left">
          <div className="grid gap-3 rounded-[0.9rem] border border-white/8 bg-[#101821] p-3 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[0.8rem] bg-[radial-gradient(circle_at_50%_20%,rgba(166,150,255,0.3),transparent_18%),linear-gradient(160deg,#1b2435,#0a1016_70%)] p-3">
              <div className="mb-3 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.2em] text-[#aeb7c5]">
                <span>Chat</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/70">
                  Live
                </span>
              </div>
              <div className="space-y-2 text-sm text-[#e7ecf6]">
                <div className="rounded-full bg-white/5 px-3 py-2">Did you see that?</div>
                <div className="rounded-full bg-[#a394ff]/12 px-3 py-2 text-[#efe8ff]">HAHAHA</div>
                <div className="rounded-full bg-white/5 px-3 py-2">Play that again!</div>
                <div className="rounded-full bg-white/5 px-3 py-2">This is why I sent it.</div>
              </div>
            </div>
            <div className="rounded-[0.8rem] border border-white/8 bg-[#0d1219] p-3">
              <div className="mb-3 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.2em] text-[#aeb7c5]">
                <span>Reactions</span>
                <span className="text-[#d8d0ff]">+12</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xl">
                <span>🔥</span>
                <span>😍</span>
                <span>😂</span>
                <span>👏</span>
              </div>
            </div>
          </div>
        </div>
      );
  }
}

function FaqItem({
  item,
  defaultOpen,
}: {
  item: { question: string; answer: string };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border-b border-white/5 last:border-b-0 text-left">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base text-white sm:px-6"
      >
        <span className="font-medium">{item.question}</span>
        <ChevronDown
          className={['transition-transform', open ? 'rotate-180' : ''].join(' ')}
          size={18}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-7 text-[#b4b9c2] sm:px-6">
          {item.answer}
        </div>
      )}
    </div>
  );
}
