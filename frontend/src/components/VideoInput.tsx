import { useState } from 'react';
import { extractVideoId } from '@/utils/youtube';

interface VideoInputProps {
  onVideoChange: (videoId: string) => void;
}

export default function VideoInput({ onVideoChange }: VideoInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a YouTube video URL');
      return;
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setError('Invalid YouTube URL. Please enter a valid link.');
      return;
    }

    setError('');
    onVideoChange(videoId);
    setUrl('');
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full items-stretch">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError('');
          }}
          placeholder="Paste YouTube video URL (e.g. https://www.youtube.com/watch?v=...)"
          className="flex-1 bg-[#1B2A49] border border-[#2E4372] text-sm text-slate-100 placeholder:text-slate-400 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 transition-colors"
        />
        <button
          type="submit"
          className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          Change Video
        </button>
      </form>
      {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
    </div>
  );
}
