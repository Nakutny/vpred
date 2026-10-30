import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { posts, categories } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useAuth } from '../contexts/AuthContext';

const ErdEditor = lazy(() => import('../components/ErdEditor'));

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;

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
  const fileInputRef = useRef(null);

  const [post, setPost] = useState(null);
  const [postType, setPostType] = useState('research');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryList, setCategoryList] = useState([]);
  const [images, setImages] = useState([]);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showErd, setShowErd] = useState(false);
  const [erdData, setErdData] = useState(null);
  const [erdFlash, setErdFlash] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Admin: move to channel
  const [showMoveChannel, setShowMoveChannel] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveCategoryId, setMoveCategoryId] = useState('');
  const [moveConfirm, setMoveConfirm] = useState(false);
  const [moving, setMoving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your content here…' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }

    setLoading(true);
    // Try draft endpoint first (requireAuth, no optionalAuth issues).
    // Fall back to regular get for published posts being edited by admin/mod.
    const fetchPost = posts.getDraft(slug).catch(() => posts.get(slug));
    Promise.all([
      fetchPost,
      categories.list(),
    ]).then(([postData, catData]) => {
      const p = postData.post;
      if (!isAdmin && user.id !== p.author_id) {
        if (p.status === 'published') {
          navigate('/post/' + slug);
        } else {
          navigate('/');
        }
        return;
      }
      setPost(p);
      setPostType(p.type || 'research');
      setTitle(p.title);
      setSummary(p.summary || '');
      setCategoryId(p.category_id || '');
      setCategoryList(catData.categories || []);
      // Load existing images (stored as JSON array or plain array)
      if (p.images) {
        const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
        setImages(Array.isArray(imgs) ? imgs : []);
      }
      if (p.erd_data) { setErdData(p.erd_data); setShowErd(true); }
    }).catch(err => {
      console.error('[EditPostPage] load failed:', err);
      setError(err.message || 'Could not load post.');
    }).finally(() => setLoading(false));
  }, [user, authLoading, slug]);

  useEffect(() => {
    if (editor && post?.content) editor.commands.setContent(post.content);
  }, [editor, post]);

  async function handleMoveChannel() {
    if (!moveTarget || moveTarget === postType) return;
    if (moveTarget === 'research' && !moveCategoryId) return; // category required
    setMoving(true); setError('');
    try {
      const body = { type: moveTarget };
      if (moveTarget === 'research') body.category_id = moveCategoryId;
      else body.category_id = null;
      await posts.update(post.id, body);
      // Navigate to new channel
      const dest = moveTarget === 'research' ? '/' : moveTarget === 'essay' ? '/essays' : '/texts';
      navigate(dest);
    } catch (err) {
      setError(err.message);
    } finally {
      setMoving(false);
    }
  }

  function showErdFlash(msg) {
    setErdFlash(msg);
    setTimeout(() => setErdFlash(''), 2500);
  }

  async function handleImageUpload(e) {
    setImageError('');
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { setImageError(`Maximum ${MAX_IMAGES} images allowed.`); e.target.value = ''; return; }

    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) { setImageError('Only image files are allowed.'); continue; }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) { setImageError(`Image too large — max ${MAX_SIZE_MB}MB per image.`); continue; }
      try {
        const url = await uploadImage(file);
        setImages(prev => prev.length >= MAX_IMAGES ? prev : [...prev, url]);
      } catch (err) {
        setImageError('Upload failed: ' + err.message);
      }
    }
    e.target.value = '';
  }

  async function handlePublish() {
    if (!post) return;
    setPublishing(true); setError('');
    try {
      const content = editor?.getHTML() || '';
      await posts.update(post.id, {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        category_id: categoryId || undefined,
        images,
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
    // For published posts, require content; drafts can be saved empty
    if (post?.status === 'published' && (!content || content === '<p></p>')) {
      return setError('Content is required.');
    }

    setSubmitting(true);
    setError('');
    try {
      await posts.update(post.id, {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        category_id: categoryId || undefined,
        images,
        erd_data: erdData || null,
      });
      if (post.status === 'draft') {
        // Stay on edit page after saving draft — show success flash
        setError('');
        // Small visual feedback
        const btn = document.activeElement;
        if (btn) btn.blur();
      } else {
        navigate('/post/' + post.slug);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div style={{ maxWidth: 820, margin: '60px auto', padding: '0 24px', color: 'var(--muted)' }}>Loading...</div>
  );

  const isDraft = post?.status === 'draft';

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
      {!isDraft && (
        <Link to={'/post/' + slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to post
        </Link>
      )}

      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>
        {isDraft ? 'Continue Draft' : 'Edit Post'}
      </h1>

      {isDraft && (
        <div style={{
          background: 'rgba(var(--accent-rgb, 99,102,241), 0.08)',
          border: '1px solid var(--accent)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            📝 <strong>Draft</strong> — Not yet published. Save changes, then publish when ready.
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
        {isDraft
          ? 'Your draft is only visible to you.'
          : 'All content must be based on publicly available information.'}
      </p>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Title *</label>
          <input
            className="input"
            style={{ fontSize: 16 }}
            placeholder="Your title…"
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
            placeholder="Brief summary shown in the overview…"
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

        {/* Images — only for text/essay posts */}
        {postType !== 'research' && (
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
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
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
        )}

        {/* Editor */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Content {!isDraft && '*'}</label>
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
        {postType === 'research' && (
          <div style={{ marginBottom: 24 }}>
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
                  onSave={() => showErdFlash('Diagram state captured — click "Save changes" to persist to server.')}
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
          </div>
        )}

        {/* Admin: Move to channel */}
        {isAdmin && !isDraft && (
          <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <button
              type="button"
              onClick={() => { setShowMoveChannel(v => !v); setMoveConfirm(false); setMoveTarget(''); setMoveCategoryId(''); }}
              style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              {showMoveChannel ? 'Cancel move' : 'Move to another channel (Admin)'}
            </button>

            {showMoveChannel && (
              <div style={{ marginTop: 14, padding: '16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Current channel: <strong style={{ color: 'var(--text)' }}>
                    {postType === 'research' ? 'Research' : postType === 'essay' ? 'Essays' : 'Texts'}
                  </strong>. Only the channel is changed — author, date and content remain untouched.
                </p>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Move to</label>
                  <select
                    className="input"
                    value={moveTarget}
                    onChange={e => { setMoveTarget(e.target.value); setMoveCategoryId(''); setMoveConfirm(false); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">— Select channel —</option>
                    {postType !== 'research' && <option value="research">Research</option>}
                    {postType !== 'essay'    && <option value="essay">Essays</option>}
                    {postType !== 'text'     && <option value="text">Texts</option>}
                  </select>
                </div>

                {/* Category required when moving to Research */}
                {moveTarget === 'research' && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select
                      className="input"
                      value={moveCategoryId}
                      onChange={e => { setMoveCategoryId(e.target.value); setMoveConfirm(false); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">— Select category —</option>
                      {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {!moveCategoryId && moveTarget === 'research' && (
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>A category is required for Research posts.</p>
                    )}
                  </div>
                )}

                {/* Confirmation */}
                {moveTarget && (moveTarget !== 'research' || moveCategoryId) && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={moveConfirm} onChange={e => setMoveConfirm(e.target.checked)} />
                      I confirm: move this post to <strong style={{ color: 'var(--text)' }}>
                        {moveTarget === 'research' ? 'Research' : moveTarget === 'essay' ? 'Essays' : 'Texts'}
                      </strong>
                      {moveTarget === 'research' && moveCategoryId && (
                        <> › {categoryList.find(c => String(c.id) === String(moveCategoryId))?.name}</>
                      )}
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleMoveChannel}
                  disabled={!moveTarget || !moveConfirm || moving || (moveTarget === 'research' && !moveCategoryId)}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: moveConfirm ? 'var(--accent)' : 'var(--surface)',
                    color: moveConfirm ? '#fff' : 'var(--muted)',
                    fontSize: 13, fontWeight: 600, opacity: (!moveTarget || !moveConfirm || moving) ? 0.5 : 1,
                  }}
                >
                  {moving ? 'Moving…' : 'Move post'}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
          {!isDraft && <Link to={'/post/' + slug} className="btn btn-ghost">Cancel</Link>}
        </div>
      </form>
    </div>
  );
}
