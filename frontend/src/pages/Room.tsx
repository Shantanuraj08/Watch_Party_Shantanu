import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import YoutubePlayer from '@/components/YoutubePlayer';
import VideoInput from '@/components/VideoInput';
import PlaybackControls from '@/components/PlaybackControls';
import ParticipantList, { type Participant } from '@/components/ParticipantList';
import { getParticipants } from '@/services/api';
import socket from '@/services/socket';

export default function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(() => localStorage.getItem('userRole'));
  const [isRemoved, setIsRemoved] = useState(false);
  const [copied, setCopied] = useState(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const pendingStateRef = useRef<{ videoId?: string; currentTime?: number; isPlaying?: boolean } | null>(null);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const currentParticipant = participants.find((p) => p.userId === currentUserId);
  const currentRole = currentParticipant?.role || userRole || 'PARTICIPANT';
  const canControlPlayback = currentRole === 'HOST' || currentRole === 'MODERATOR';

  const applyRoomState = (p: any, state: { videoId?: string; currentTime?: number; isPlaying?: boolean }) => {
    if (!p || !state?.videoId || !/^[a-zA-Z0-9_-]{11}$/.test(state.videoId)) return;

    setVideoId(state.videoId);
    const targetTime = typeof state.currentTime === 'number' ? Math.max(0, state.currentTime) : 0;
    setCurrentTime(targetTime);
    setIsPlaying(Boolean(state.isPlaying));

    const currentLoadedId = currentVideoIdRef.current || (typeof p.getVideoData === 'function' ? p.getVideoData()?.video_id : null);

    if (currentLoadedId === state.videoId) {
      if (typeof p.seekTo === 'function') {
        p.seekTo(targetTime, true);
      }
      if (state.isPlaying) {
        p.playVideo?.();
      } else {
        p.pauseVideo?.();
      }
    } else {
      currentVideoIdRef.current = state.videoId;
      if (state.isPlaying) {
        if (typeof p.loadVideoById === 'function') {
          p.loadVideoById(state.videoId, targetTime);
        }
        p.playVideo?.();
      } else {
        if (typeof p.cueVideoById === 'function') {
          p.cueVideoById(state.videoId, targetTime);
        } else if (typeof p.loadVideoById === 'function') {
          p.loadVideoById(state.videoId, targetTime);
        }
      }
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const p = playerRef.current;
      if (canControlPlayback && p && typeof p.getCurrentTime === 'function') {
        const time = p.getCurrentTime();
        socket.emit('pause', { currentTime: Math.max(0, time) });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [canControlPlayback]);

  useEffect(() => {
    if (!roomCode) return;
    setIsLoading(true);
    setError('');

    getParticipants(roomCode)
      .then((data) => {
        setParticipants(data || []);
        const myP = (data || []).find((p: Participant) => p.userId === localStorage.getItem('userId'));
        if (myP?.role) {
          setUserRole(myP.role);
          localStorage.setItem('userRole', myP.role);
        }
      })
      .catch((err: any) => setError(err.response?.data?.message || 'Failed to load participants.'))
      .finally(() => setIsLoading(false));
  }, [roomCode]);

  useEffect(() => {
    const roomId = localStorage.getItem('roomId') || roomCode;
    const userId = localStorage.getItem('userId');

    if (!roomId || !userId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      socket.emit('join_room', { roomId, userId });
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    socket.on('room_state', (state: { videoId?: string; currentTime?: number; isPlaying?: boolean }) => {
      console.log('Received room_state:', state);
      if (!state?.videoId || !/^[a-zA-Z0-9_-]{11}$/.test(state.videoId)) return;
      const p = playerRef.current;
      if (p && typeof p.seekTo === 'function') {
        applyRoomState(p, state);
      } else {
        pendingStateRef.current = state;
        setVideoId(state.videoId);
      }
    });

    socket.on('play', (data: { currentTime?: number }) => {
      console.log("[SYNC 4] PARTICIPANT RECEIVED:", performance.now());
      console.log('Received play:', data);
      const p = playerRef.current;
      if (p) {
        if (typeof data?.currentTime === 'number' && typeof p.seekTo === 'function') {
          p.seekTo(data.currentTime, true);
        }
        p.playVideo?.();
      }
      if (typeof data?.currentTime === 'number') {
        setCurrentTime(data.currentTime);
      }
      setIsPlaying(true);
    });

    socket.on('pause', (data: { currentTime?: number }) => {
      console.log('Received pause:', data);
      const p = playerRef.current;
      if (p) {
        if (typeof data?.currentTime === 'number' && typeof p.seekTo === 'function') {
          p.seekTo(data.currentTime, true);
        }
        p.pauseVideo?.();
      }
      if (typeof data?.currentTime === 'number') {
        setCurrentTime(data.currentTime);
      }
      setIsPlaying(false);
    });

    socket.on('seek', (data: { time?: number }) => {
      const time = data?.time;
      console.log("[SEEK 4] PARTICIPANT RECEIVED:", performance.now(), time);
      console.log('Received seek:', data);
      const p = playerRef.current;
      if (typeof data?.time === 'number') {
        p?.seekTo?.(data.time, true);
        setCurrentTime(data.time);
      }
    });

    socket.on('change_video', (data: { videoId?: string }) => {
      console.log('Received change_video:', data);
      if (data?.videoId && /^[a-zA-Z0-9_-]{11}$/.test(data.videoId)) {
        currentVideoIdRef.current = data.videoId;
        setVideoId(data.videoId);
        setCurrentTime(0);
        setIsPlaying(false);
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(data.videoId);
        }
      }
    });

    socket.on('user_joined', (user: { userId: string; name: string; role: 'HOST' | 'MODERATOR' | 'PARTICIPANT' }) => {
      console.log('Received user_joined:', user);
      setParticipants((prev) => {
        const exists = prev.some((p) => p.userId === user.userId);
        if (exists) {
          return prev.map((p) => (p.userId === user.userId ? { ...p, ...user, isActive: true } : p));
        }
        return [...prev, { ...user, isActive: true }];
      });
    });

    socket.on('user_left', (data: { userId: string }) => {
      console.log('Received user_left:', data);
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, isActive: false } : p))
      );
    });

    socket.on('role_assigned', (data: { userId: string; role: 'HOST' | 'MODERATOR' | 'PARTICIPANT' }) => {
      console.log('Received role_assigned:', data);
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, role: data.role } : p))
      );
      if (data.userId === localStorage.getItem('userId')) {
        setUserRole(data.role);
        localStorage.setItem('userRole', data.role);
      }
    });

    socket.on('host_transferred', (data: { previousHostId: string; newHostId: string }) => {
      console.log('Received host_transferred:', data);
      const myId = localStorage.getItem('userId');
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.userId === data.newHostId) return { ...p, role: 'HOST' };
          if (p.userId === data.previousHostId) return { ...p, role: 'PARTICIPANT' };
          return p;
        })
      );
      if (data.newHostId === myId) {
        setUserRole('HOST');
        localStorage.setItem('userRole', 'HOST');
      } else if (data.previousHostId === myId) {
        setUserRole('PARTICIPANT');
        localStorage.setItem('userRole', 'PARTICIPANT');
      }
    });

    socket.on('participant_removed', (data: { userId: string }) => {
      console.log('Received participant_removed:', data);
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      if (data.userId === localStorage.getItem('userId')) {
        setIsRemoved(true);
        playerRef.current?.pauseVideo?.();
        socket.disconnect();
      }
    });

    socket.on('error', (err) => {
      console.log('Socket error:', err);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room_state');
      socket.off('play');
      socket.off('pause');
      socket.off('seek');
      socket.off('change_video');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('role_assigned');
      socket.off('host_transferred');
      socket.off('participant_removed');
      socket.off('error');
      socket.disconnect();
    };
  }, [roomCode]);

  useEffect(() => {
    if (!player) return;
    const timer = setInterval(() => {
      try {
        if (typeof player.getCurrentTime === 'function') setCurrentTime(player.getCurrentTime() || 0);
        if (typeof player.getDuration === 'function') setDuration(player.getDuration() || 0);
      } catch { }
    }, 500);
    return () => clearInterval(timer);
  }, [player]);

  const handlePlay = () => {
    const p = playerRef.current || player;
    p?.playVideo?.();
    setIsPlaying(true);
    const time = typeof p?.getCurrentTime === 'function' ? p.getCurrentTime() : 0;
    console.log("[SYNC 1] HOST EMIT:", performance.now());
    socket.emit('play', { currentTime: Math.max(0, time) });
  };

  const handlePause = () => {
    const p = playerRef.current || player;
    p?.pauseVideo?.();
    setIsPlaying(false);
    const time = typeof p?.getCurrentTime === 'function' ? p.getCurrentTime() : 0;
    socket.emit('pause', { currentTime: Math.max(0, time) });
  };

  const handleSeek = (time: number) => {
    const p = playerRef.current || player;
    p?.seekTo?.(time, true);
    setCurrentTime(time);
    console.log("[SEEK 1] HOST EMIT:", performance.now(), time);
    socket.emit('seek', { time: Math.max(0, time) });
  };

  const handleVideoChange = (newVideoId: string) => {
    if (!newVideoId || !/^[a-zA-Z0-9_-]{11}$/.test(newVideoId)) return;
    currentVideoIdRef.current = newVideoId;
    setVideoId(newVideoId);
    setCurrentTime(0);
    setIsPlaying(false);
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById(newVideoId);
    }
    socket.emit('change_video', { videoId: newVideoId });
  };

  const handleMakeModerator = (targetUserId: string) => {
    socket.emit('assign_role', { targetUserId, role: 'MODERATOR' });
  };

  const handleTransferHost = (targetUserId: string) => {
    socket.emit('transfer_host', { targetUserId });
  };

  const handleRemoveParticipant = (targetUserId: string) => {
    socket.emit('remove_participant', { targetUserId });
  };


  const handleCopyCode = () => {
    const code = roomCode || '';
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { }
      document.body.removeChild(textarea);
    });
  };

  if (isRemoved) {
    return (
      <div className="min-h-screen bg-[#1B2A49] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#24365D] border border-[#2E4372] rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="size-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center font-bold text-xl">
            ✕
          </div>
          <h2 className="text-xl font-bold text-white">Removed from Room</h2>
          <p className="text-sm text-slate-300">
            You have been removed from this room by the host.
          </p>
          <Link to="/">
            <button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1B2A49] text-white flex flex-col">
      <header className="border-b border-[#2E4372] bg-[#1B2A49]/95 backdrop-blur px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-90">
            <span className="size-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              WP
            </span>
            <span>Watch Party</span>
          </Link>

          <div className="hidden sm:flex items-center bg-[#24365D] rounded-xl px-3 py-1.5 gap-2 border border-[#2E4372]/60 ml-4">
            <span className="text-xs text-slate-300 font-medium">Room</span>
            <span className="font-mono text-xs font-semibold text-white tracking-wider">
              {roomCode || 'DEMO01'}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="ml-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="sm:hidden flex items-center bg-[#24365D] rounded-xl px-2.5 py-1 gap-2 border border-[#2E4372]/60">
            <span className="font-mono text-xs font-semibold text-white tracking-wider">
              {roomCode || 'DEMO01'}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <Link to="/">
            <button
              type="button"
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#24365D] hover:bg-[#2B3F6C] rounded-xl transition-colors cursor-pointer"
            >
              Leave Room
            </button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <section className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative">
            <YoutubePlayer
              videoId={videoId}
              isHost={currentRole === 'HOST'}
              onPlayerReady={(p) => {
                setPlayer(p);
                playerRef.current = p;
                currentVideoIdRef.current = videoId;
                if (pendingStateRef.current) {
                  applyRoomState(p, pendingStateRef.current);
                  pendingStateRef.current = null;
                }
              }}
              onStateChange={(playing) => {
                setIsPlaying(playing);
              }}
            />
          </div>
          {canControlPlayback && (
            <>
              <VideoInput onVideoChange={handleVideoChange} />
              <PlaybackControls
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
              />
            </>
          )}
        </section>

        <aside className="lg:col-span-1">
          <ParticipantList
            participants={participants}
            isLoading={isLoading}
            error={error}
            onMakeModerator={handleMakeModerator}
            onTransferHost={handleTransferHost}
            onRemoveParticipant={handleRemoveParticipant}
          />
        </aside>
      </main>
    </div>
  );
}
