import { useState, useRef } from 'react';

interface PlaybackControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
}

function formatTime(totalSeconds: number = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function PlaybackControls({
  onPlay,
  onPause,
  onSeek,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
}: PlaybackControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const isDraggingRef = useRef(false);
  const dragTimeRef = useRef(0);

  const displayTime = isDragging ? dragTime : currentTime;

  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    const val = Number(e.currentTarget.value);
    dragTimeRef.current = val;
    setDragTime(val);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    dragTimeRef.current = val;
    setDragTime(val);
    if (!isDraggingRef.current) {
      onSeek(val);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      const val = !isNaN(Number(e.currentTarget.value)) ? Number(e.currentTarget.value) : dragTimeRef.current;
      onSeek(val);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLInputElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      const val = !isNaN(Number(e.currentTarget.value)) ? Number(e.currentTarget.value) : dragTimeRef.current;
      onSeek(val);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#2E4372] bg-[#24365D] p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-300 w-10">
          {formatTime(displayTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={1}
          value={displayTime}
          onPointerDown={handlePointerDown}
          onChange={handleChange}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="w-full h-1.5 bg-[#1B2A49] rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-xs font-mono text-slate-300 w-10 text-right">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onPlay}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
            isPlaying
              ? 'bg-blue-600 text-white'
              : 'bg-blue-600/80 hover:bg-blue-600 text-white'
          }`}
        >
          Play
        </button>
        <button
          type="button"
          onClick={onPause}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
            !isPlaying
              ? 'bg-[#1B2A49] text-white border border-[#2E4372]'
              : 'bg-[#1B2A49] hover:bg-[#203257] text-slate-300 hover:text-white border border-[#2E4372]/60'
          }`}
        >
          Pause
        </button>
      </div>
    </div>
  );
}
