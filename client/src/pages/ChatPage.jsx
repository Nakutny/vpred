import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messages as messagesApi } from '../lib/api';
import Avatar from '../components/Avatar';

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

  async function load() {
    try {
      const res = await messagesApi.getThread(userId);
      setMsgs(res.messages || []);
      if (res.otherUser) setOtherUser(res.otherUser);
    } catch (e) {
      if (e.status === 403) {
        setError('You can only message your friends.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    load();
    // Poll for new messages every 10 seconds
    pollRef.current = setInterval(load, 10000);
    return () => clearInterval(pollRef.current);
  }, [userId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      await messagesApi.send(userId, body);
      await load();
    } catch (e) {
      setError(e.message);
      setText(body);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Group consecutive messages by sender
  function groupMessages(messages) {
    const groups = [];
    messages.forEach(msg => {
      const last = groups[groups.length - 1];
      if (last && last.senderId === msg.sender_id) {
        last.msgs.push(msg);
      } else {
        groups.push({ senderId: msg.sender_id, msgs: [msg] });
      }
    });
    return groups;
  }

  const grouped = groupMessages(msgs);
  const title = otherUser ? otherUser.username : '…';

  return (
    <div style={{
      maxWidth: 680, margin: '0 auto', padding: '24px 24px 0',
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16,
      }}>
        <Link to="/friends" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>
          ←
        </Link>
        {otherUser && (
          <>
            <Link to={`/profile/${otherUser.username}`}>
              <Avatar avatarUrl={otherUser.avatar_url} username={otherUser.username} size={38} />
            </Link>
            <Link
              to={`/profile/${otherUser.username}`}
              style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', textDecoration: 'none' }}
            >
              {otherUser.username}
            </Link>
          </>
        )}
        {!otherUser && !loading && (
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--muted)' }}>Conversation</span>
        )}
      </div>

      {/* Message area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--danger)' }}>{error}</div>
        )}
        {!loading && !error && msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            <p style={{ marginBottom: 8 }}>No messages yet.</p>
            <p style={{ fontSize: 13 }}>Say hi to {title}!</p>
          </div>
        )}

        {grouped.map((group, gi) => {
          const isMe = group.senderId === user?.id;
          return (
            <div key={gi} style={{ marginBottom: 16 }}>
              {group.msgs.map((msg, mi) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: 8,
                    marginBottom: mi === group.msgs.length - 1 ? 0 : 4,
                  }}
                >
                  {/* Avatar only on first message in group for other user */}
                  {!isMe && mi === 0 ? (
                    <Link to={`/profile/${otherUser?.username || ''}`} style={{ flexShrink: 0 }}>
                      <Avatar avatarUrl={otherUser?.avatar_url} username={otherUser?.username} size={28} />
                    </Link>
                  ) : !isMe ? (
                    <div style={{ width: 28, flexShrink: 0 }} />
                  ) : null}

                  <div style={{ maxWidth: '72%' }}>
                    <div
                      style={{
                        padding: '8px 14px',
                        borderRadius: isMe
                          ? mi === 0 ? '18px 18px 4px 18px' : mi === group.msgs.length - 1 ? '4px 18px 18px 18px' : '4px 18px 18px 4px'
                          : mi === 0 ? '18px 18px 18px 4px' : mi === group.msgs.length - 1 ? '18px 4px 18px 18px' : '18px 4px 4px 18px',
                        background: isMe ? 'var(--accent)' : 'var(--surface)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        color: isMe ? '#fff' : 'var(--text)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                    {mi === group.msgs.length - 1 && (
                      <div style={{
                        fontSize: 10, color: 'var(--muted)',
                        marginTop: 4,
                        textAlign: isMe ? 'right' : 'left',
                        paddingLeft: isMe ? 0 : 4,
                        paddingRight: isMe ? 4 : 0,
                      }}>
                        {formatTime(msg.created_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!error && (
        <form
          onSubmit={send}
          style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            padding: '16px 0 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <textarea
            className="input"
            style={{
              flex: 1, minHeight: 42, maxHeight: 160, resize: 'none',
              fontSize: 14, lineHeight: 1.5, paddingTop: 10, paddingBottom: 10,
              overflowY: 'auto',
            }}
            placeholder={`Message ${title}…`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: text.trim() ? 'var(--accent)' : 'var(--surface)',
              color: text.trim() ? '#fff' : 'var(--muted)',
              cursor: text.trim() ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 600, flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}
