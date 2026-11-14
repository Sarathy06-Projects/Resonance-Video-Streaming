export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  authorName?: string;
  thumbnailUrl: string;
}

const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();

  // If already an 11-char ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

export function isValidYouTubeUrl(urlOrId: string): boolean {
  return extractYouTubeId(urlOrId) !== null;
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeVideoInfo> {
  const defaultInfo: YouTubeVideoInfo = {
    videoId,
    title: `YouTube Video (${videoId})`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    authorName: 'YouTube Creator',
  };

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data: any = await response.json();
      if (data && data.title) {
        return {
          videoId,
          title: data.title,
          authorName: data.author_name || 'YouTube Creator',
          thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }
  } catch (err) {
    // Graceful fallback to default thumbnail and generic title
  }

  return defaultInfo;
}

export const CURATED_DEMO_VIDEOS = [
  {
    videoId: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny (Official 4K 60fps)',
    channel: 'Blender Foundation',
    thumbnail: 'https://img.youtube.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    category: 'Animation',
  },
  {
    videoId: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio 📚 - beats to relax/study to',
    channel: 'Lofi Girl',
    thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    category: 'Music Live',
  },
  {
    videoId: 'e-ORhEE9VVg',
    title: 'Sintel - Open-Movie by Blender Foundation',
    channel: 'Blender Foundation',
    thumbnail: 'https://img.youtube.com/vi/e-ORhEE9VVg/hqdefault.jpg',
    category: 'Cinema',
  },
  {
    videoId: 'kJQP7kiw5Fk',
    title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
    channel: 'Luis Fonsi',
    thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    category: 'Music Video',
  },
  {
    videoId: 'qC0vDKVPCrw',
    title: 'Cyberpunk 2077 — Official Launch Trailer',
    channel: 'Cyberpunk 2077',
    thumbnail: 'https://img.youtube.com/vi/qC0vDKVPCrw/hqdefault.jpg',
    category: 'Gaming',
  },
];
