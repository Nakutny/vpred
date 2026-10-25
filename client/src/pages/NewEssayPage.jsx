import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { posts } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useAuth } from '../contexts/AuthContext';

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--muted)',
        fontSize: 13, fontWeight: 600, transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;

export default function NewEssayPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [summary, setSummary] = useState('');
  const [images, setImages] = useState([]);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login');
  }, [user, authLoading]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your essay here…' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
  });

  async function handleImageUpload(e) {
    setImageError('');
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed.`);
      e.target.value = '';
      return;
    }

    const toProcess = files.slice(0, remaining);

    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) {
        setImageError('Only image files are allowed.');
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setImageError(`Image too large — max ${MAX_SIZE_MB}MB per image.`);
        continue;
      }
      try {
        const url = await uploadImage(file);
        setImages(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, url];
        });
      } catch (err) {
        setImageError('Upload failed: ' + err.message);
      }
    }

    e.target.value = '';
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveDraft() {
    const content = editor?.getHTML() || '';
    if (!title.trim()) { setError('A title is required to save a draft.'); return; }
    setDraftSaving(true); setError('');
    try {
      const d = await posts.create({
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        type: 'essay',
        topic: topic.trim() || undefined,
        images,
        status: 'draft',
      });
      setDraftMsg('Draft saved!');
      setTimeout(() => setDraftMsg(''), 2500);
      navigate(`/post/${d.post.slug}/edit`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const content = editor?.getHTML() || '';
    if (!title.trim()) return setError('Title is required.');
    if (!content || content === '<p></p>') return setError('Content is required.');

    setSubmitting(true);
    setError('');
    try {
      const d = await posts.create({
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        type: 'essay',
        topic: topic.trim() || undefined,
        images,
        status: 'published',
      });
      navigate(`/post/${d.post.slug}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 6 }}>
        Write an Essay
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        Essays are personal — write freely on any topic. Philosophy, observations, ideas, stories.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Title *</label>
          <input
            className="input"
            style={{ fontSize: 18 }}
            placeholder="Your essay title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={300}
          />
        </div>

        {/* Topic (free text) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Topic <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional — e.g. "Epistemology", "Absurdism", "Language")</span>
          </label>
          <input
            className="input"
            placeholder="Enter any topic or theme…"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            maxLength={100}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Free text — no predefined list. Write whatever fits best.
          </div>
        </div>

        {/* Summary */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Summary <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional — shown in the essay feed)</span>
          </label>
          <textarea
            className="input"
            style={{ minHeight: 70, resize: 'vertical' }}
            placeholder="A brief teaser for your essay…"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Images */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Images <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional — up to {MAX_IMAGES}, max {MAX_SIZE_MB}MB each)</span>
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 120, height: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
                {i === 0 && (
                  <span style={{
                    position: 'absolute', bottom: 4, left: 4,
                    fontSize: 9, background: 'rgba(0,0,0,0.6)', color: '#fff',
                    padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>Cover</span>
                )}
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 120, height: 90, borderRadius: 8,
                  border: '2px dashed var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  color: 'var(--muted)', fontSize: 11,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Add image
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />

          {imageError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{imageError}</div>
          )}
        </div>

        {/* Editor */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Content *</label>

          {editor && (
            <div style={{
              display: 'flex', gap: 2, padding: '6px 10px',
              background: 'var(--surface2)', borderRadius: '8px 8px 0 0',
              border: '1px solid var(--border)', borderBottom: 'none', flexWrap: 'wrap',
            }}>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarBtn>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• —</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1.</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">"</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">`</ToolbarBtn>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolbarBtn>
            </div>
          )}
          <EditorContent editor={editor} style={{ borderRadius: editor ? '0 0 8px 8px' : '8px' }} />
        </div>

        {error && (
          <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {draftMsg && <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 8 }}>{draftMsg}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Publishing…' : 'Publish essay'}
          </button>
          <button type="button" onClick={saveDraft} disabled={draftSaving} className="btn btn-ghost">
            {draftSaving ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="button" onClick={() => navigate('/essays')} className="btn btn-ghost" style={{ color: 'var(--muted)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
