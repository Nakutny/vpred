import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { posts, categories } from '../lib/api';
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

export default function NewPostPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryList, setCategoryList] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
    categories.list().then(d => setCategoryList(d.categories || [])).catch(() => {});
  }, [user]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your research here. Cite your sources.' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
  });

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
        category_id: categoryId || undefined,
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
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>
        New Post
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        All posts must be based on publicly available information. Unsupported claims may be removed.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Title *</label>
          <input
            className="input"
            style={{ fontSize: 16 }}
            placeholder="A clear, specific title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={300}
          />
        </div>

        {/* Summary */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Summary <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            className="input"
            style={{ minHeight: 70, resize: 'vertical' }}
            placeholder="Brief summary shown in the feed..."
            value={summary}
            onChange={e => setSummary(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Category</label>
          <select
            className="input"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">— Select category —</option>
            {categoryList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Editor */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Content *</label>

          {/* Toolbar */}
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
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{ }</ToolbarBtn>
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Publishing...' : 'Publish post'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
