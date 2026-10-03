import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '@/services/api';

export default function Home() {
  const navigate = useNavigate();

  const [activeModal, setActiveModal] = useState<'create' | 'join' | null>(null);

  // Form states
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Please enter your name');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError('');
      const data = await createRoom(createName.trim());
      if (data?.user?.id) localStorage.setItem('userId', data.user.id);
      if (data?.room?.id) localStorage.setItem('roomId', data.room.id);
      if (data?.role) localStorage.setItem('userRole', data.role);
      navigate(`/room/${data.code}`);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) {
      setJoinError('Please enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setJoinError('Please enter a room code');
      return;
    }

    try {
      setIsJoining(true);
      setJoinError('');
      const savedUserId = localStorage.getItem('userId');
      const data = await joinRoom(joinCode.trim().toUpperCase(), joinName.trim(), savedUserId);
      if (data?.user?.id) localStorage.setItem('userId', data.user.id);
      if (data?.room?.id) localStorage.setItem('roomId', data.room.id);
      if (data?.role) localStorage.setItem('userRole', data.role);
      navigate(`/room/${data.code}`);
    } catch (err: any) {
      setJoinError(err.response?.data?.message || 'Failed to join room. Please check the code.');
    } finally {
      setIsJoining(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setCreateError('');
    setJoinError('');
  };

  return (
    <div className="min-h-screen bg-[#1B2A49] text-white flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header */}
      <div className="text-center max-w-lg mb-10">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
          Watch Party
        </h1>
        <p className="text-slate-300 text-sm md:text-base mt-3">
          Watch videos together in real time with friends
        </p>
      </div>

      {/* Two Large Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Card 1: Create Room */}
        <div
          onClick={() => setActiveModal('create')}
          className="bg-[#24365D] border border-[#2E4372] rounded-2xl p-8 flex flex-col justify-between cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Create Room</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Start a new session and invite friends with your own room code.
            </p>
          </div>
          <button
            type="button"
            className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer"
          >
            Create Room
          </button>
        </div>

        {/* Card 2: Join Room */}
        <div
          onClick={() => setActiveModal('join')}
          className="bg-[#24365D] border border-[#2E4372] rounded-2xl p-8 flex flex-col justify-between cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Join Room</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Enter an existing room code to watch synchronized videos together.
            </p>
          </div>
          <button
            type="button"
            className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer"
          >
            Join Room
          </button>
        </div>
      </div>

      {/* Create Room Modal */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#24365D] border border-[#2E4372] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Create Room</h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={isCreating}
                  className="w-full bg-[#1B2A49] border border-[#2E4372] rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
                  autoFocus
                />
              </div>

              {createError && (
                <p className="text-xs text-red-300 bg-red-950/60 border border-red-800/60 rounded-lg p-2.5">
                  {createError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isCreating}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {activeModal === 'join' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#24365D] border border-[#2E4372] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Join Room</h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  disabled={isJoining}
                  className="w-full bg-[#1B2A49] border border-[#2E4372] rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. AB12CD"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  disabled={isJoining}
                  className="w-full bg-[#1B2A49] border border-[#2E4372] rounded-xl px-4 py-2.5 text-white placeholder-slate-400 uppercase tracking-widest font-mono focus:outline-none focus:border-blue-400"
                />
              </div>

              {joinError && (
                <p className="text-xs text-red-300 bg-red-950/60 border border-red-800/60 rounded-lg p-2.5">
                  {joinError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isJoining}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isJoining ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
