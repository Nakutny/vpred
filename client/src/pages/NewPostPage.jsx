import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { posts, categories } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const ErdEditor = lazy(() => import('../components/ErdEditor'));

const DRAFT_KEY = 'vpred_post_draft';

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      padding: '5px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--muted)',
      fontSize: 13, fontWeight: 600, transition: 'all 0.1s',
    }}>{children}</button>
  );
}

export default function NewPostPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const parentPostId    = location.state?.parentPostId    || null;
  const parentPostTitle = location.state?.parentPostTitle || null;
  const parentPostSlug  = location.state?.parentPostSlug  || null;

  const [title, setTitle]           = useState('');
  const [summary, setSummary]       = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryList, setCategoryList] = useState([]);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showErd, setShowErd]       = useState(false);
  const [erdData, setErdData]       = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const autoSaveTimer = useRef(null);

  // Load saved draft on mount
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    categories.list().then(d => setCategoryList(d.categories || [])).catch(() => {});

    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title) setTitle(d.title);
        if (d.summary) setSummary(d.summary);
        if (d.categoryId) setCategoryId(d.categoryId);
        if (d.erdData) { setErdData(d.erdData); setShowErd(true); }
        if (d.content && editor) editor.commands.setContent(d.content);
        // store content for editor init below
        if (d.content) window.__draftContent = d.content;
      }
    } catch {}
  }, [user]); // eslint-disable-line

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your research here. Cite your sources.' }),
    ],
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onCreate({ editor }) {
      if (window.__draftContent) {
        editor.commands.setContent(window.__draftContent);
        delete window.__draftContent;
      }
    },
  });

  // Auto-save draft every 10s while typing
  useEffect(() => {
    if (!title && !editor?.getText()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(), 10000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [title, summary, categoryId, erdData]); // eslint-disable-line

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, summary, categoryId, erdData,
        content: editor?.getHTML() || '',
        savedAt: new Date().toISOString(),
      }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const content = editor?.getHTML() || '';
    if (!title.trim()) return setError('Title is required.');
    if (!content || content === '<p></p>') return setError('Content is required.');
    setSubmitting(true); setError('');
    try {
      const d = await posts.create({
        title: title.trim(), content,
        summary: summary.trim() || undefined,
        category_id: categoryId || undefined,
        status: 'published',
        parent_post_id: parentPostId || undefined,
        erd_data: erdData || undefined,
      });
      clearDraft();
      navigate('/post/' + d.post.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const topLevel = categoryList.filter(c => !c.parent_id);
  const subCats  = categoryList.filter(c => !!c.parent_id);

  function renderCategoryOptions() {
    const options = [];
    topLevel.forEach(parent => {
      options.push(<option key={parent.id} value={parent.id}>{parent.name}</option>);
      subCats.filter(c => c.parent_id === parent.id).forEach(child =>
        options.push(<option key={child.id} value={child.id}>{'  ↳ '}{child.name}</option>)
      );
    });
    subCats.filter(c => !topLevel.find(p => p.id === c.parent_id)).forEach(o =>
      options.push(<option key={o.id} value={o.id}>{o.name}</option>)
    );
    return options;
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.8rem', fontWeight: 400, margin: 0 }}>
          {parentPostId ? 'Write a Follow-up' : 'New Post'}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {draftSaved && <span style={{ fontSize: 12, color: 'var(--success)' }}>Draft saved</span>}
          <button type="button" onClick={saveDraft} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
            Save draft
          </button>
        </div>
      </div>

      {parentPostId && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M3 17l4-4-4-4M9 17h12"/></svg>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Continuation of <strong style={{ color: 'var(--text)' }}>{parentPostTitle}</strong>
          </span>
          <button type="button" onClick={() => navigate('/post/' + parentPostSlug)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>
            Cancel
          </button>
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        All posts must be based on publicly available information. Unsupported claims may be removed.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Title *</label>
          <input className="input" style={{ fontSize: 16 }} placeholder="A clear, specific title..." value={title} onChange={e => setTitle(e.target.value)} maxLength={300} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Summary <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea className="input" style={{ minHeight: 70, resize: 'vertical' }} placeholder="Brief summary shown in the feed..." value={summary} onChange={e => setSummary(e.target.value)} maxLength={500} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="">— Select category —</option>
            {renderCategoryOptions()}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Content *</label>
          {editor && (
            <div style={{ display: 'flex', gap: 2, padding: '6px 10px', background: 'var(--surface2)', borderRadius: '8px 8px 0 0', border: '1px solid var(--border)', borderBottom: 'none', flexWrap: 'wrap' }}>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3">H3</ToolbarBtn>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullets">• —</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered">1.</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">"</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">`</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{ }</ToolbarBtn>
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">&#8617;</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">&#8618;</ToolbarBtn>
            </div>
          )}
          <EditorContent editor={editor} style={{ borderRadius: editor ? '0 0 8px 8px' : '8px' }} />
        </div>

        {/* ERD */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Entity-Relationship Diagram <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <button type="button" onClick={() => setShowErd(v => !v)} style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: showErd ? 'var(--accent)' : 'transparent',
              color: showErd ? '#fff' : 'var(--muted)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}>
              {showErd ? 'Hide ERD' : 'Add ERD'}
            </button>
            {erdData && !showErd && (
              <span style={{ fontSize: 12, color: 'var(--success)' }}>ERD saved ({erdData.nodes?.length || 0} entities)</span>
            )}
          </div>
          {showErd && (
            <Suspense fallback={<div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading diagram editor...</div>}>
              <ErdEditor value={erdData} onChange={setErdData} onSave={saveDraft} />
            </Suspense>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid var(--danger)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Publishing...' : (parentPostId ? 'Publish follow-up' : 'Publish post')}
          </button>
          <button type="button" onClick={() => { saveDraft(); navigate(-1); }} className="btn btn-ghost">
            Save & exit
          </button>
          <button type="button" onClick={() => { clearDraft(); navigate(-1); }} className="btn btn-ghost" style={{ color: 'var(--muted)' }}>
            Discard
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
          Your draft is saved automatically every 10 seconds and restored if you close this page.
        </p>
      </form>
    </div>
  );
}
