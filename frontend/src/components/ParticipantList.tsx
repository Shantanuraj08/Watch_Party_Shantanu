import { useState, useEffect, useRef } from 'react';
import socket from '@/services/socket';

export interface Participant {
  userId: string;
  name: string;
  role: 'HOST' | 'MODERATOR' | 'PARTICIPANT';
  isActive?: boolean;
}

export interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
}

interface ParticipantListProps {
  participants: Participant[];
  isLoading?: boolean;
  error?: string;
  onMakeModerator?: (userId: string) => void;
  onTransferHost?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
}

export default function ParticipantList({
  participants = [],
  isLoading = false,
  error = '',
  onMakeModerator,
  onTransferHost,
  onRemoveParticipant,
}: ParticipantListProps) {
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const isCurrentHost = participants.some((p) => p.userId === currentUserId && p.role === 'HOST');

  // Count ONLY currently ONLINE participants
  const onlineCount = participants.filter((p) => p.isActive !== false).length;

  // Listen for real-time chat messages
  useEffect(() => {
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (activeTabRef.current !== 'chat') {
        setUnreadCount((c) => c + 1);
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, []);

  // Auto-scroll chat to bottom inside chat container only (prevents window/viewport scroll)
  useEffect(() => {
    if (activeTab === 'chat' && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) return;

    socket.emit('send_message', { message: trimmed });
    setInputText('');
  };

  // Sort online participants first, then offline participants
  // Secondary sort by role (HOST > MODERATOR > PARTICIPANT)
  const sortedParticipants = [...participants].sort((a, b) => {
    const aOnline = a.isActive !== false ? 1 : 0;
    const bOnline = b.isActive !== false ? 1 : 0;
    if (aOnline !== bOnline) {
      return bOnline - aOnline;
    }
    const roleRank = (role: string) => (role === 'HOST' ? 3 : role === 'MODERATOR' ? 2 : 1);
    return roleRank(b.role) - roleRank(a.role);
  });

  return (
    <div className="bg-[#24365D] border border-[#2E4372] rounded-2xl flex flex-col h-[580px] shadow-lg overflow-hidden">
      {/* Fixed Card Header with Tabs */}
      <div className="p-3 border-b border-[#2E4372] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 bg-[#1B2A49] p-1 rounded-xl border border-[#2E4372]/60">
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'participants'
                ? 'bg-[#24365D] text-white shadow-sm border border-[#2E4372]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Participants
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1B2A49] text-blue-200 border border-[#2E4372]/80 font-medium">
              {onlineCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              setUnreadCount(0);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-[#24365D] text-white shadow-sm border border-[#2E4372]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chat
            {unreadCount > 0 && activeTab !== 'chat' && (
              <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        </div>
        {activeTab === 'participants' ? (
          <span className="text-xs text-slate-300 pr-1">
            {participants.length} total
          </span>
        ) : (
          <span className="text-xs text-slate-400 pr-1">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'participants' ? (
        /* Scrollable list area */
        <div className="p-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-2.5">
          {isLoading && (
            <p className="text-xs text-slate-400 py-4 text-center">Loading participants...</p>
          )}

          {error && (
            <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg p-2.5 text-center">
              Failed to load participants.
            </p>
          )}

          {!isLoading && !error && sortedParticipants.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">No participants found</p>
          )}

          {!isLoading &&
            !error &&
            sortedParticipants.map((p) => {
              const isHost = p.role === 'HOST';
              const isMod = p.role === 'MODERATOR';
              const isOnline = p.isActive !== false;

              return (
                <div
                  key={p.userId}
                  className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors ${
                    isOnline
                      ? 'border-[#2E4372]/60 bg-[#1B2A49]'
                      : 'border-transparent bg-[#1B2A49]/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-slate-100 truncate">
                        {p.name}
                      </span>
                      {/* Subtle role tags without outlined badge look */}
                      {isHost && (
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          Host
                        </span>
                      )}
                      {isMod && (
                        <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          Moderator
                        </span>
                      )}
                    </div>

                    {/* Restored simple Online/Offline status: small dot + text, no bordered pill */}
                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span
                        className={`size-2 rounded-full ${
                          isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span className={isOnline ? 'text-slate-300' : 'text-slate-500'}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Host management controls */}
                  {isCurrentHost && !isHost && (
                    <div className="flex items-center gap-2 pt-1 border-t border-[#2E4372]/40 flex-wrap">
                      {!isMod && (
                        <button
                          type="button"
                          className="text-xs px-2.5 py-1 font-medium text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition-colors cursor-pointer"
                          onClick={() => onMakeModerator?.(p.userId)}
                        >
                          Make Moderator
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs px-2.5 py-1 font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 rounded-lg transition-colors cursor-pointer"
                        onClick={() => onTransferHost?.(p.userId)}
                      >
                        Transfer Host
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2.5 py-1 font-medium text-red-300 bg-red-500/15 hover:bg-red-500/25 rounded-lg transition-colors cursor-pointer ml-auto"
                        onClick={() => onRemoveParticipant?.(p.userId)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        /* Chat Tab Content */
        <>
          <div ref={messagesContainerRef} className="p-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
                <div className="size-10 rounded-full bg-[#1B2A49] border border-[#2E4372] flex items-center justify-center text-slate-300 text-base mb-2">
                  💬
                </div>
                <p className="text-sm font-medium text-slate-200">No messages yet</p>
                <p className="text-xs text-slate-400 mt-1">Send a message to start chatting with the room!</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.userId === currentUserId;
                const timeString = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={`${msg.userId}-${msg.timestamp}-${idx}`}
                    className={`flex flex-col max-w-[85%] ${
                      isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span
                        className={`text-[11px] font-semibold ${
                          isMe ? 'text-blue-300' : 'text-slate-300'
                        }`}
                      >
                        {isMe ? 'You' : msg.userName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {timeString}
                      </span>
                    </div>
                    <div
                      className={`p-2.5 rounded-2xl text-xs break-words whitespace-pre-wrap leading-relaxed ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-[#1B2A49] text-slate-100 border border-[#2E4372]/60 rounded-bl-xs'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message input */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[#2E4372] flex items-center gap-2 shrink-0 bg-[#203052]/50"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-[#1B2A49] border border-[#2E4372] rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
