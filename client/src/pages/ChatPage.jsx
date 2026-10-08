import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { messages as messagesApi, profile as profileApi } from '../lib/api';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';

export default function ChatPage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  async function loadMessages() {
    try {
      const res = await messagesApi.get(userId);
      setMsgs(res.messages);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadOtherUser() {
    // We need username to show profile link; get from message or profile
    // Try to load from messages first — if no messages yet, we get the username from profile lookup
    // We'll try loading their profile by ID via a workaround: find from conversations
    try {
      const convRes = await messagesApi.conversations();
      const conv = convRes.conversations.find(c => c.other_id === userId);
      if (conv) {
        setOtherUser({ id: userId, username: conv.other_username, avatar_url: conv.other_avatar });
      }
    } catch {}
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadMessages(), loadOtherUser()]);
      setLoading(false);
    }
    init();

    // Poll every 5 seconds
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await messagesApi.send(userId, text.trim());
      setMsgs(prev => [...prev, {
        ...res.message,
        sender_username: user.username,
        sender_avatar: user.avatar_url,
      }]);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center text-[var(--color-muted)]">Loading…</div>
  );

  const displayName = otherUser?.username || 'User';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)] mb-4">
        {otherUser && (
          <Link to={`/profile/${otherUser.username}`}>
            <Avatar src={otherUser.avatar_url} username={otherUser.username} size={40} />
          </Link>
        )}
        <div>
          <Link to={`/profile/${displayName}`} className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]">
            {displayName}
          </Link>
          <p className="text-xs text-[var(--color-muted)]">Private conversation</p>
        </div>
        <button
          onClick={() => navigate('/friends')}
          className="ml-auto text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          ← Back
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.length === 0 && (
          <p className="text-center text-[var(--color-muted)] text-sm py-8">
            No messages yet. Say hello!
          </p>
        )}
        {msgs.map(msg => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex-shrink-0">
                <Avatar
                  src={msg.sender_avatar}
                  username={msg.sender_username}
                  size={32}
                />
              </div>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div
                  className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-[var(--color-accent)] text-white rounded-tr-sm'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-[var(--color-muted)] px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="mt-4 flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Write a message… (Enter to send)"
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
          style={{ minHeight: 44, maxHeight: 120, overflowY: 'auto' }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
      <p className="text-[10px] text-[var(--color-muted)] mt-1 text-right">{text.length}/2000</p>
    </div>
  );
}
