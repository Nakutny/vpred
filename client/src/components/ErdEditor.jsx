/**
 * ErdEditor.jsx — Patch 18
 * Improvements:
 *  - Softer, muted colors for entity types
 *  - Single-click to edit attribute/edge labels (no double-click needed)
 *  - No MiniMap
 *  - Image attachment per entity (upload, resize, drag within node)
 *  - Save button below canvas
 *  - Fullscreen toggle
 *  - JPG export button (bottom-left of canvas)
 *  - readOnly view mode for PostPage
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Muted entity colors ──────────────────────────────────────────────────────
const ENTITY_TYPES = [
  { value: 'company',        label: 'Company',          color: '#4a7fa5', icon: '🏢' },
  { value: 'shadow_company', label: 'Shadow Company',   color: '#7a5c9e', icon: '🕵️' },
  { value: 'fake_company',   label: 'Fake Company',     color: '#a05252', icon: '⚠️' },
  { value: 'person',         label: 'Person',           color: '#4a9e7a', icon: '👤' },
  { value: 'group',          label: 'Group of Persons', color: '#9e824a', icon: '👥' },
  { value: 'custom',         label: 'Custom',           color: '#6b7280', icon: '⬡'  },
];

function getEntityMeta(type) {
  return ENTITY_TYPES.find(t => t.value === type) || ENTITY_TYPES[ENTITY_TYPES.length - 1];
}

// ─── Image component inside entity (resizable + draggable within node) ────────
function EntityImage({ img, index, readOnly, onUpdate, onDelete }) {
  const dragRef  = useRef(null);
  const resizeRef = useRef(null);
  const [pos, setPos]   = useState({ x: img.x || 0, y: img.y || 0 });
  const [size, setSize] = useState({ w: img.w || 120, h: img.h || 90 });

  // Drag image within node
  function onMouseDownDrag(e) {
    if (readOnly) return;
    e.stopPropagation();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    function onMove(ev) {
      setPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    }
    function onUp(ev) {
      const newPos = { x: ev.clientX - startX, y: ev.clientY - startY };
      setPos(newPos);
      onUpdate(index, { ...img, x: newPos.x, y: newPos.y });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Resize handle
  function onMouseDownResize(e) {
    if (readOnly) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    function onMove(ev) {
      const newW = Math.max(60, startW + (ev.clientX - startX));
      const newH = Math.max(45, startH + (ev.clientY - startY));
      setSize({ w: newW, h: newH });
    }
    function onUp(ev) {
      const newW = Math.max(60, startW + (ev.clientX - startX));
      const newH = Math.max(45, startH + (ev.clientY - startY));
      setSize({ w: newW, h: newH });
      onUpdate(index, { ...img, w: newW, h: newH });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={dragRef}
      className="nodrag"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        cursor: readOnly ? 'default' : 'move',
        zIndex: 10,
        border: readOnly ? 'none' : '1px dashed rgba(255,255,255,0.4)',
        borderRadius: 4,
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDownDrag}
    >
      <img
        src={img.src}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
        draggable={false}
      />
      {!readOnly && (
        <>
          {/* Delete image */}
          <button
            type="button"
            className="nodrag"
            onMouseDown={e => { e.stopPropagation(); onDelete(index); }}
            style={{
              position: 'absolute', top: 2, right: 2,
              background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
              width: 16, height: 16, cursor: 'pointer', color: '#fff', fontSize: 11,
              lineHeight: '16px', textAlign: 'center', padding: 0,
            }}
          >×</button>
          {/* Resize handle */}
          <div
            ref={resizeRef}
            className="nodrag"
            onMouseDown={onMouseDownResize}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 12, height: 12, cursor: 'se-resize',
              background: 'rgba(255,255,255,0.7)', borderRadius: '2px 0 0 0',
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Custom Entity Node ───────────────────────────────────────────────────────
function EntityNode({ data, selected }) {
  const meta = getEntityMeta(data.entityType);
  const [editingAttr, setEditingAttr] = useState(null);
  const [attrDraft, setAttrDraft]     = useState('');
  const fileRef = useRef(null);

  function startEditAttr(i) {
    setEditingAttr(i);
    setAttrDraft(data.attributes[i]);
  }

  function commitAttr(i) {
    const newAttrs = [...data.attributes];
    if (attrDraft.trim() === '') {
      newAttrs.splice(i, 1);
    } else {
      newAttrs[i] = attrDraft.trim();
    }
    data.onChange({ ...data, attributes: newAttrs });
    setEditingAttr(null);
  }

  function addAttr() {
    const newAttrs = [...(data.attributes || []), ''];
    data.onChange({ ...data, attributes: newAttrs });
    // auto-focus new attr
    setTimeout(() => setEditingAttr(newAttrs.length - 1), 30);
    setAttrDraft('');
  }

  function deleteAttr(i) {
    const arr = [...data.attributes];
    arr.splice(i, 1);
    data.onChange({ ...data, attributes: arr });
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const images = [...(data.images || []), { src: ev.target.result, x: 0, y: 40, w: 120, h: 90 }];
      data.onChange({ ...data, images });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function updateImage(i, updated) {
    const images = [...(data.images || [])];
    images[i] = updated;
    data.onChange({ ...data, images });
  }

  function deleteImage(i) {
    const images = [...(data.images || [])];
    images.splice(i, 1);
    data.onChange({ ...data, images });
  }

  const borderColor = selected ? meta.color : 'var(--border)';
  const imgList = data.images || [];
  // Extra height for images
  const imgAreaH = imgList.length > 0 ? Math.max(...imgList.map(img => (img.y || 0) + (img.h || 90))) + 8 : 0;

  return (
    <div style={{
      minWidth: 190,
      maxWidth: 280,
      background: 'var(--surface)',
      border: `2px solid ${borderColor}`,
      borderRadius: 10,
      overflow: 'visible',
      boxShadow: selected ? `0 0 0 3px ${meta.color}33` : '0 2px 8px rgba(0,0,0,0.18)',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 13,
      position: 'relative',
    }}>
      <Handle type="source" position={Position.Right}  style={{ background: meta.color, border: 'none', width: 9, height: 9 }} />
      <Handle type="target" position={Position.Left}   style={{ background: meta.color, border: 'none', width: 9, height: 9 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: meta.color, border: 'none', width: 9, height: 9 }} />
      <Handle type="target" position={Position.Top}    id="top"    style={{ background: meta.color, border: 'none', width: 9, height: 9 }} />

      {/* Header */}
      <div style={{ background: meta.color + 'cc', padding: '8px 32px 8px 12px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: '8px 8px 0 0' }}>
        <span style={{ fontSize: 15 }}>{meta.icon}</span>
        {data.readOnly ? (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, flex: 1, wordBreak: 'break-word' }}>{data.label}</span>
        ) : (
          <input
            value={data.label}
            onChange={e => data.onChange({ ...data, label: e.target.value })}
            placeholder="Entity name"
            className="nodrag"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontWeight: 700, fontSize: 13, width: '100%',
            }}
          />
        )}
      </div>

      {/* Type selector */}
      <div style={{ padding: '3px 12px', background: meta.color + '18', borderBottom: '1px solid var(--border)' }}>
        {data.readOnly ? (
          <span style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
        ) : (
          <select
            value={data.entityType}
            onChange={e => data.onChange({ ...data, entityType: e.target.value })}
            className="nodrag"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: meta.color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              padding: 0, width: '100%',
            }}
          >
            {ENTITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Attributes */}
      <div style={{ padding: '8px 12px 6px' }}>
        {(data.attributes || []).map((attr, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ color: meta.color, flexShrink: 0, fontSize: 10 }}>◆</span>
            {!data.readOnly && editingAttr === i ? (
              <input
                autoFocus
                value={attrDraft}
                onChange={e => setAttrDraft(e.target.value)}
                onBlur={() => commitAttr(i)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitAttr(i);
                  if (e.key === 'Escape') setEditingAttr(null);
                }}
                className="nodrag"
                style={{
                  flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px', fontSize: 12, outline: 'none', color: 'var(--text)',
                }}
              />
            ) : (
              <span
                className="nodrag"
                style={{
                  flex: 1, fontSize: 12, color: 'var(--text)',
                  cursor: data.readOnly ? 'default' : 'text',
                  padding: '1px 4px', borderRadius: 3,
                }}
                onClick={() => !data.readOnly && startEditAttr(i)}
                title={data.readOnly ? '' : 'Click to edit'}
              >
                {attr || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>empty</span>}
              </span>
            )}
            {!data.readOnly && (
              <button
                type="button"
                className="nodrag"
                onClick={() => deleteAttr(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, fontSize: 13, lineHeight: 1, flexShrink: 0 }}
              >×</button>
            )}
          </div>
        ))}

        {!data.readOnly && (
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            <button
              type="button"
              className="nodrag"
              onClick={addAttr}
              style={{
                flex: 1, background: 'none', border: '1px dashed var(--border)', borderRadius: 5,
                color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: '3px 0',
              }}
            >+ Attribute</button>
            <button
              type="button"
              className="nodrag"
              onClick={() => fileRef.current?.click()}
              title="Add image to entity"
              style={{
                background: 'none', border: '1px dashed var(--border)', borderRadius: 5,
                color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: '3px 8px',
              }}
            >🖼</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </div>
        )}
      </div>

      {/* Images area */}
      {imgList.length > 0 && (
        <div style={{ position: 'relative', height: imgAreaH, borderTop: '1px solid var(--border)', margin: '0 0 2px' }}>
          {imgList.map((img, i) => (
            <EntityImage
              key={i}
              img={img}
              index={i}
              readOnly={!!data.readOnly}
              onUpdate={updateImage}
              onDelete={deleteImage}
            />
          ))}
        </div>
      )}

      {/* Delete node */}
      {!data.readOnly && (
        <button
          type="button"
          className="nodrag"
          onClick={() => data.onDelete()}
          title="Delete entity"
          style={{
            position: 'absolute', top: 5, right: 5,
            background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: '50%',
            width: 17, height: 17, cursor: 'pointer',
            color: '#fff', fontSize: 11, lineHeight: '17px', textAlign: 'center', padding: 0, zIndex: 20,
          }}
        >×</button>
      )}
    </div>
  );
}

// ─── Edge with single-click label editing ────────────────────────────────────
function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(data?.label || '');

  useEffect(() => { setDraft(data?.label || ''); }, [data?.label]);

  function commit() {
    data?.onChange(draft.trim());
    setEditing(false);
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', zIndex: 10 }}>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(data?.label || ''); setEditing(false); } }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--accent)',
                borderRadius: 5, padding: '2px 8px', fontSize: 11, outline: 'none',
                color: 'var(--text)', minWidth: 80,
              }}
            />
          ) : (
            <div
              onClick={() => !data?.readOnly && setEditing(true)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '2px 8px', fontSize: 11, color: data?.label ? 'var(--text)' : 'var(--muted)',
                cursor: data?.readOnly ? 'default' : 'pointer',
                whiteSpace: 'nowrap', minWidth: 28, textAlign: 'center',
              }}
              title={data?.readOnly ? '' : 'Click to set relationship label'}
            >
              {data?.label || (data?.readOnly ? '' : '+ label')}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { entity: EntityNode };
const edgeTypes = { labeled: LabeledEdge };

// ─── JPG Export button (uses ReactFlow instance) ──────────────────────────────
function ExportButton() {
  const { getNodes } = useReactFlow();

  function exportJpg() {
    const viewport = document.querySelector('.react-flow__viewport');
    if (!viewport) return;
    import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/es/index.js')
      .then(({ toJpeg }) => toJpeg(viewport, { quality: 0.95, backgroundColor: '#1a1a2e' }))
      .then(dataUrl => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'erd-diagram.jpg';
        a.click();
      })
      .catch(() => alert('Export failed. Try a different browser.'));
  }

  return (
    <button
      type="button"
      onClick={exportJpg}
      title="Download as JPG"
      style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 5,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '5px 10px', fontSize: 11,
        color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      ⬇ JPG
    </button>
  );
}

// ─── Inner editor (needs ReactFlowProvider context) ───────────────────────────
function ErdInner({ value, onChange, readOnly, fullscreen, onToggleFullscreen, onSave }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const initialized = useRef(false);
  const emitRef = useRef(true);

  // ── helpers ──
  function makeNodeChange(id) {
    return (newData) => setNodes(nds => nds.map(n => n.id === id
      ? { ...n, data: { ...newData, onChange: makeNodeChange(id), onDelete: makeNodeDelete(id), readOnly } }
      : n
    ));
  }
  function makeNodeDelete(id) {
    return () => {
      setNodes(nds => nds.filter(n => n.id !== id));
      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    };
  }
  function makeEdgeLabelChange(id) {
    return (label) => setEdges(eds => eds.map(e => e.id === id
      ? { ...e, data: { ...e.data, label, onChange: makeEdgeLabelChange(id), readOnly } }
      : e
    ));
  }

  // Load initial value once
  useEffect(() => {
    if (initialized.current) return;
    emitRef.current = false;
    if (value?.nodes?.length) {
      setNodes(value.nodes.map(n => ({
        ...n,
        data: { ...n.data, onChange: makeNodeChange(n.id), onDelete: makeNodeDelete(n.id), readOnly },
      })));
    }
    if (value?.edges?.length) {
      setEdges(value.edges.map(e => ({
        ...e,
        data: { ...e.data, onChange: makeEdgeLabelChange(e.id), readOnly },
      })));
    }
    initialized.current = true;
    setTimeout(() => { emitRef.current = true; }, 100);
  }, []); // eslint-disable-line

  // Emit to parent
  useEffect(() => {
    if (!emitRef.current || readOnly) return;
    const cleanNodes = nodes.map(({ data: { onChange: _a, onDelete: _b, readOnly: _c, ...d }, ...rest }) => ({ ...rest, data: d }));
    const cleanEdges = edges.map(({ data: { onChange: _a, readOnly: _b, ...d }, ...rest }) => ({ ...rest, data: d }));
    onChange(cleanNodes.length === 0 && cleanEdges.length === 0 ? null : { nodes: cleanNodes, edges: cleanEdges });
  }, [nodes, edges]); // eslint-disable-line

  const onConnect = useCallback((params) => {
    const id = `e-${Date.now()}`;
    const newEdge = {
      ...params, id, type: 'labeled',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      style: { stroke: '#6b7280', strokeWidth: 1.5 },
      data: { label: '', readOnly },
    };
    setEdges(eds => {
      const added = addEdge(newEdge, eds);
      return added.map(e => e.id === id ? { ...e, data: { ...e.data, onChange: makeEdgeLabelChange(id) } } : e);
    });
  }, [readOnly]); // eslint-disable-line

  function addEntity(type) {
    const id = `node-${Date.now()}`;
    const meta = getEntityMeta(type);
    setNodes(nds => [...nds, {
      id, type: 'entity',
      position: { x: 80 + Math.random() * 280, y: 60 + Math.random() * 180 },
      data: { label: meta.label, entityType: type, attributes: [], images: [], onChange: makeNodeChange(id), onDelete: makeNodeDelete(id), readOnly: false },
    }]);
  }

  // ── ReadOnly view ──
  if (readOnly) {
    if (!value?.nodes?.length) return null;
    return (
      <div style={{ width: '100%', height: fullscreen ? '100%' : 420, borderRadius: fullscreen ? 0 : 10, overflow: 'hidden', border: fullscreen ? 'none' : '1px solid var(--border)', position: 'relative' }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          panOnDrag zoomOnScroll
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <button type="button" onClick={onToggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--text)' }}>
          {fullscreen ? '⤡ Exit' : '⤢ Full'}
        </button>
        <ExportButton />
      </div>
    );
  }

  // ── Editor view ──
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: fullscreen ? 0 : 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginRight: 2 }}>Add:</span>
        {ENTITY_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => addEntity(t.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.color}55`,
              background: t.color + '15', color: t.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onToggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>
          {fullscreen ? '⤡ Exit fullscreen' : '⤢ Fullscreen'}
        </button>
        {(nodes.length > 0 || edges.length > 0) && (
          <button type="button" onClick={() => { setNodes([]); setEdges([]); }}
            style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: fullscreen ? 0 : 460, position: 'relative', background: 'var(--surface2)' }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode="Delete" multiSelectionKeyCode="Shift"
        >
          <Background color="var(--border)" gap={20} />
          <Controls />
        </ReactFlow>
        <ExportButton />

        {nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⬡</div>
              <div style={{ fontSize: 13 }}>Click an entity type above to add it</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Drag handles to connect entities · Click edge labels to rename</div>
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      {onSave && (
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onSave} className="btn btn-primary" style={{ fontSize: 13 }}>
            Save diagram
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Changes are saved automatically when you publish the post</span>
        </div>
      )}
    </div>
  );
}

// ─── Public export (wraps with ReactFlowProvider) ─────────────────────────────
export default function ErdEditor({ value, onChange, readOnly = false, onSave }) {
  const [fullscreen, setFullscreen] = useState(false);

  const inner = (
    <ReactFlowProvider>
      <ErdInner
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen(f => !f)}
        onSave={onSave}
      />
    </ReactFlowProvider>
  );

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--surface2)', display: 'flex', flexDirection: 'column',
      }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: readOnly ? 420 : 560, borderRadius: 10, overflow: 'hidden' }}>
      {inner}
    </div>
  );
}
