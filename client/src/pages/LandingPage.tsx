import React, { useState, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Link2,
  Users,
  Shield,
  MessageSquare,
  Zap,
  CheckCircle2,
  Lock,
  Radio,
  ArrowRight,
  Database,
  Film,
} from 'lucide-react';
import { api } from '../services/api';
import { detectProviderQuick, PROVIDER_META, COMPATIBILITY_META } from '../utils/resolver';

interface LandingPageProps {
  onRoomCreated: (roomId: string, token: string, hostName: string) => void;
  onOpenPricing: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onRoomCreated,
  onOpenPricing,
}) => {
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
    api.getCuratedDemos().then((res) => {
      if (res && res.demos) setCuratedDemos(res.demos);
    }).catch(() => {});
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
        setError(err.message || 'Invalid YouTube link');
      } finally {
        setIsValidating(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      setError('Please paste a YouTube link');
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
        // Save token to localStorage for smooth reconnect
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
    const url = demo.url || (demo.videoId?.startsWith('http') ? demo.videoId : `https://www.youtube.com/watch?v=${demo.videoId}`);
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

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full flex flex-col items-center text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-brand-600/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-850 border border-dark-700/80 text-xs text-gray-300 mb-6 shadow-sm">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Serverless Architecture • Powered by <strong>Neon PostgreSQL</strong></span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.15] mb-5">
          Watch supported videos together, in{' '}
          <span className="bg-gradient-to-r from-brand-glow via-indigo-300 to-indigo-400 bg-clip-text text-transparent">
            flawless sync
          </span>
          .
        </h1>

        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Paste any supported video link (YouTube, MP4, HLS, Vimeo, Dailymotion, DASH, Twitch).
          Create a room. Invite your friends. Watch in real-time with flawless synchronization.
        </p>

        {/* Room Creation Box */}
        <div className="w-full max-w-xl bg-dark-900/90 border border-dark-700/80 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md relative z-10 text-left">
          <form onSubmit={handleCreateRoom} className="space-y-4">
            {/* Video URL Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  1. Paste Video Link
                </label>
                {activeMeta && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${activeMeta.badgeBg}`}>
                    {activeMeta.name}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://... (YouTube, MP4, .m3u8, Vimeo, Dailymotion, .mpd, Twitch)"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors pr-10"
                />
                <Link2 className="w-4 h-4 text-gray-500 absolute right-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Video Preview Card if detected */}
            {previewInfo && (
              <div className="p-3 rounded-xl bg-dark-850 border border-dark-700/80 flex flex-col gap-2.5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <img
                    src={previewInfo.thumbnailUrl}
                    alt={previewInfo.title}
                    className="w-20 h-12 object-cover rounded-lg bg-dark-950 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{previewInfo.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-gray-400 truncate">{previewInfo.authorName}</p>
                      {previewInfo.provider && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 uppercase font-mono">
                          {previewInfo.provider}
                        </span>
                      )}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mr-1" />
                </div>

                {/* Compatibility status pill and explanation */}
                {detected && COMPATIBILITY_META[detected.compatibility] && (
                  <div className="pt-2 border-t border-dark-750 flex items-start gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${COMPATIBILITY_META[detected.compatibility].badgeClass}`}>
                      {COMPATIBILITY_META[detected.compatibility].label}
                    </span>
                    <p className="text-[11px] text-gray-300 leading-tight">
                      {previewInfo.explanation || COMPATIBILITY_META[detected.compatibility].description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Display Name Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                2. Your Display Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Alex (Host)"
                maxLength={30}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Privacy Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-800 border-dark-700 text-brand-600 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs text-gray-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" /> Make Room Private (Passcode Protected)
                </span>
              </label>

              {isPrivate && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter room passcode (e.g. watch123)"
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreating || isValidating}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isCreating ? 'Creating Watch Room...' : 'Create Watch Room & Start'}</span>
            </button>
          </form>

          {/* Quick Demo Pickers */}
          {curatedDemos.length > 0 && (
            <div className="mt-5 pt-4 border-t border-dark-700/60">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                Or pick a quick demo video to test:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {curatedDemos.map((demo) => (
                  <button
                    key={demo.videoId}
                    onClick={() => selectDemoVideo(demo)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-dark-800/80 hover:bg-dark-750 border border-dark-700 text-left transition-colors group"
                  >
                    <img
                      src={demo.thumbnail}
                      alt={demo.title}
                      className="w-9 h-7 object-cover rounded bg-dark-950 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-200 group-hover:text-white truncate">
                        {demo.title}
                      </p>
                      <p className="text-[9px] text-gray-500 truncate">{demo.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 max-w-5xl mx-auto w-full border-t border-dark-800">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
            How Together Works
          </h2>
          <p className="text-sm text-gray-400">Zero friction. No mandatory signups for guests.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-700/70">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-base mb-4">
              1
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Paste & Create</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Paste any public YouTube video link. We allocate a low-latency room coordinator in seconds.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-700/70">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-base mb-4">
              2
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Share the Link</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Friends click the link, choose a display name, and join the room instantly without account barriers.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-700/70">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-base mb-4">
              3
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Watch in Sync</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Host plays, pauses, or seeks, and every participant's player follows with millisecond drift correction.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing / Monetization Section (Section 7) */}
      <section className="py-16 px-4 max-w-5xl mx-auto w-full border-t border-dark-800">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
            Transparent Plans
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-3 mb-2">
            Free for small groups, Premium for communities
          </h2>
          <p className="text-sm text-gray-400">Only the room host pays; guests always join free.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="p-6 rounded-2xl bg-dark-900 border border-dark-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Free</h3>
                <span className="text-xs text-gray-400 bg-dark-800 px-2.5 py-1 rounded-full">
                  Forever
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-white mb-6">₹0</div>
              <ul className="space-y-3 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Up to 3 participants per room</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Full YouTube playback sync</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Live text chat & quick reactions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Standard room links</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="mt-8 w-full py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white font-medium text-xs transition-colors"
            >
              Start Free
            </button>
          </div>

          {/* Premium Tier */}
          <div className="p-6 rounded-2xl bg-dark-900 border-2 border-brand-500/60 shadow-xl shadow-brand-500/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand-600 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl text-white">
              Recommended
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Premium</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold font-mono text-white">₹199</span>
                <span className="text-xs text-gray-400">/ month</span>
              </div>
              <ul className="space-y-3 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span><strong>Up to 15 participants</strong> per room</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span><strong>Private password-protected rooms</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span><strong>Up Next Video Queue</strong> & playlisting</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span><strong>Custom room themes</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>Priority server-side room coordinator</span>
                </li>
              </ul>
            </div>
            <button
              onClick={onOpenPricing}
              className="mt-8 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-md shadow-brand-500/30 transition-all hover:scale-[1.01]"
            >
              Get Premium (₹199)
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 px-4 border-t border-dark-800 text-center text-xs text-gray-500">
        <p>© 2026 TOGETHER • Serverless Social Video Platform • Powered by Neon PostgreSQL</p>
      </footer>
    </div>
  );
};
