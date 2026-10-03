export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // 1. Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let candidate: string | null = null;

  try {
    const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(fullUrl);

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch' || parsed.pathname.startsWith('/watch')) {
        candidate = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/')) {
        candidate = parsed.pathname.split('/')[2] || null;
      } else if (parsed.pathname.startsWith('/v/')) {
        candidate = parsed.pathname.split('/')[2] || null;
      } else if (parsed.pathname.startsWith('/live/')) {
        candidate = parsed.pathname.split('/')[2] || null;
      }
    } else if (parsed.hostname === 'youtu.be' || parsed.hostname.endsWith('.youtu.be')) {
      candidate = parsed.pathname.replace(/^\/+/, '').split('/')[0].split('?')[0] || null;
    }
  } catch {}

  // Regex fallback for formats like "watch?v=...", youtu.be, etc.
  if (!candidate) {
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/)|(?:^|[?&/])v=|watch\?v=)([a-zA-Z0-9_-]{11})/);
    if (match) {
      candidate = match[1];
    }
  }

  // Ensure candidate is strictly an 11-character video ID, never a URL, query, or partial string
  if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
    return candidate;
  }

  return null;
}
