import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { posts, categories } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const ErdEditor = lazy(() => import('../components/ErdEditor'));

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

export default function EditPostPage() {
  const { slug } = useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [postType, setPostType] = useState('research');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryList, setCategoryList] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showErd, setShowErd] = useState(false);
  const [erdData, setErdData] = useState(null);
  const [erdFlash, setErdFlash] = useState('');
  const [publishing, setPublishing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your research here. Cite your sources.' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }

    Promise.all([
      posts.get(slug),
      categories.list(),
    ]).then(([postData, catData]) => {
      const p = postData.post;
      if (!isAdmin && user.id !== p.author_id) {
        navigate('/post/' + slug);
        return;
      }
      setPost(p);
      setPostType(p.type || 'research');
      setTitle(p.title);
      setSummary(p.summary || '');
      setCategoryId(p.category_id || '');
      setCategoryList(catData.categories || []);
      if (p.erd_data) { setErdData(p.erd_data); setShowErd(true); }
      if (editor) editor.commands.setContent(p.content);
    }).catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [user, slug, editor]);

  useEffect(() => {
    if (editor && post?.content) editor.commands.setContent(post.content);
  }, [editor, post]);

  function showErdFlash(msg) {
    setErdFlash(msg);
    setTimeout(() => setErdFlash(''), 2500);
  }

  async function handlePublish() {
    if (!post) return;
    setPublishing(true); setError('');
    try {
      // Save current edits first, then publish
      const content = editor?.getHTML() || '';
      await posts.update(post.id, {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        category_id: categoryId || undefined,
        erd_data: erdData || null,
      });
      const result = await posts.publish(post.id);
      navigate('/post/' + result.post.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
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
      await posts.update(post.id, {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        category_id: categoryId || undefined,
        erd_data: erdData || null,
      });
      navigate('/post/' + post.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div style={{ maxWidth: 820, margin: '60px auto', padding: '0 24px', color: 'var(--muted)' }}>Loading...</div>
  );

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
      <Link to={'/post/' + slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to post
      </Link>

      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>
        {post?.status === 'draft' ? 'Continue Draft' : 'Edit Post'}
      </h1>

      {post?.status === 'draft' && (
        <div style={{
          background: 'rgba(var(--accent-rgb, 99,102,241), 0.08)',
          border: '1px solid var(--accent)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            📝 <strong>Draft</strong> — This post is not yet published. Save your changes and publish when ready.
          </span>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            style={{
              padding: '6px 16px', borderRadius: 7,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {publishing ? 'Publishing…' : 'Publish now'}
          </button>
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        {post?.status === 'draft'
          ? 'Write freely — your draft is only visible to you.'
          : 'All content must be based on publicly available information.'}
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

        {/* Category — only for research posts */}
        {postType === 'research' && (
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
        )}

        {/* Editor */}
        <div style={{ marginBottom: 24 }}>
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
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{ }</ToolbarBtn>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolbarBtn>
            </div>
          )}
          <EditorContent editor={editor} style={{ borderRadius: editor ? '0 0 8px 8px' : '8px' }} />
        </div>

        {/* ERD Section — only for research posts */}
        {postType === 'research' && <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Entity-Relationship Diagram{' '}
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowErd(v => !v)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: showErd ? 'var(--accent)' : 'transparent',
                color: showErd ? '#fff' : 'var(--muted)',
                fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}
            >
              {showErd ? 'Hide ERD' : (erdData ? 'Edit ERD' : 'Add ERD')}
            </button>
            {erdData && !showErd && (
              <span style={{ fontSize: 12, color: 'var(--success)' }}>
                ERD saved ({erdData.nodes?.length || 0} entities)
              </span>
            )}
          </div>
          {showErd && (
            <Suspense fallback={<div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading diagram editor...</div>}>
              <ErdEditor
                value={erdData}
                onChange={setErdData}
                onSave={() => showErdFlash('Diagram state captured — click “Save changes” to persist to server.')}
              />
            </Suspense>
          )}
          {erdFlash && (
            <div style={{
              marginTop: 8, padding: '8px 14px', borderRadius: 7, fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)',
            }}>
              {erdFlash}
            </div>
          )}
        </div>}

        {error && (
          <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
          <Link to={'/post/' + slug} className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
