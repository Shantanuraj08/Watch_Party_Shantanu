import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YoutubePlayerProps {
  videoId: string | null;
  isHost?: boolean;
  onPlayerReady?: (player: any) => void;
  onStateChange?: (isPlaying: boolean) => void;
}

export default function YoutubePlayer({ videoId, isHost = false, onPlayerReady, onStateChange }: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const onPlayerReadyRef = useRef(onPlayerReady);
  const onStateChangeRef = useRef(onStateChange);

  onPlayerReadyRef.current = onPlayerReady;
  onStateChangeRef.current = onStateChange;

  const initPlayer = (validId: string) => {
    if (!containerRef.current || playerRef.current || !window.YT?.Player) return;

    const playerVars: Record<string, any> = {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
    };

    if (!isHost) {
      playerVars.cc_load_policy = 0;
    }

    playerRef.current = new window.YT.Player(containerRef.current, {
      width: '100%',
      height: '100%',
      videoId: validId,
      playerVars,
      events: {
        onReady: (event: any) => {
          if (!isHost) {
            try {
              event.target.unloadModule?.('captions');
              event.target.unloadModule?.('cc');
            } catch {}
          }
          onPlayerReadyRef.current?.(event.target);
        },
        onStateChange: (event: any) => {
          if (!isHost && event.data === 1) {
            try {
              event.target.unloadModule?.('captions');
              event.target.unloadModule?.('cc');
            } catch {}
          }
          // YT.PlayerState.PLAYING is 1, PAUSED is 2
          onStateChangeRef.current?.(event.data === 1);
        },
      },
    });
  };

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // Handle videoId changes and initialization with valid ID
  useEffect(() => {
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;

    if (!playerRef.current) {
      if (window.YT && window.YT.Player) {
        initPlayer(videoId);
      } else {
        const prevHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevHandler) prevHandler();
          if (!playerRef.current) initPlayer(videoId);
        };

        const interval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(interval);
            if (!playerRef.current) initPlayer(videoId);
          }
        }, 50);

        return () => clearInterval(interval);
      }
    } else if (typeof playerRef.current.getVideoData === 'function' && typeof playerRef.current.loadVideoById === 'function') {
      const currentVideoId = playerRef.current.getVideoData()?.video_id;
      if (currentVideoId && currentVideoId !== videoId) {
        playerRef.current.loadVideoById(videoId);
        if (!isHost) {
          try {
            playerRef.current.unloadModule?.('captions');
            playerRef.current.unloadModule?.('cc');
          } catch {}
        }
      }
    }
  }, [videoId]);

  return (
    <div className="relative aspect-video w-full rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl flex items-center justify-center">
      {/* Target container for YouTube iframe */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Transparent overlay blocking direct mouse/touch interaction with YouTube iframe */}
      <div className="absolute inset-0 z-10" />
    </div>
  );
}
