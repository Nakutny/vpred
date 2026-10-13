/**
 * ErdEditor.jsx
 * Interactive Entity-Relationship Diagram editor using React Flow.
 * Props:
 *   value: { nodes, edges } | null  — current ERD state
 *   onChange: (erdData | null) => void
 *   readOnly: bool — view-only mode (PostPage)
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Entity types ────────────────────────────────────────────────────────────
const ENTITY_TYPES = [
  { value: 'company',        label: 'Company',          color: '#3b82f6', icon: '🏢' },
  { value: 'shadow_company', label: 'Shadow Company',   color: '#8b5cf6', icon: '🕵️' },
  { value: 'fake_company',   label: 'Fake Company',     color: '#ef4444', icon: '⚠️' },
  { value: 'person',         label: 'Person',           color: '#10b981', icon: '👤' },
  { value: 'group',          label: 'Group of Persons', color: '#f59e0b', icon: '👥' },
  { value: 'custom',         label: 'Custom',           color: '#6b7280', icon: '⬡'  },
];

function getEntityMeta(type) {
  return ENTITY_TYPES.find(t => t.value === type) || ENTITY_TYPES[ENTITY_TYPES.length - 1];
}

// ─── Custom Entity Node ───────────────────────────────────────────────────────
function EntityNode({ data, selected }) {
  const meta = getEntityMeta(data.entityType);
  const [editingAttr, setEditingAttr] = useState(null); // index being edited
  const [attrDraft, setAttrDraft]     = useState('');

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
    const newAttrs = [...(data.attributes || []), 'New attribute'];
    data.onChange({ ...data, attributes: newAttrs });
  }

  function deleteAttr(i) {
    const newAttrs = [...data.attributes];
    newAttrs.splice(i, 1);
    data.onChange({ ...data, attributes: newAttrs });
  }

  const borderColor = selected ? meta.color : 'var(--border)';

  return (
    <div style={{
      minWidth: 180,
      maxWidth: 260,
      background: 'var(--surface)',
      border: `2px solid ${borderColor}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: selected ? `0 0 0 3px ${meta.color}33` : '0 2px 8px rgba(0,0,0,0.15)',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 13,
      position: 'relative',
    }}>
      {/* Handles */}
      <Handle type="source" position={Position.Right} style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />
      <Handle type="target" position={Position.Left}  style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />
      <Handle type="target" position={Position.Top}   id="top"    style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />

      {/* Header */}
      <div style={{ background: meta.color, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
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

      {/* Type badge */}
      <div style={{ padding: '4px 12px', background: meta.color + '22', borderBottom: '1px solid var(--border)' }}>
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
      <div style={{ padding: '8px 12px' }}>
        {(data.attributes || []).map((attr, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ color: meta.color, flexShrink: 0 }}>◆</span>
            {!data.readOnly && editingAttr === i ? (
              <input
                autoFocus
                value={attrDraft}
                onChange={e => setAttrDraft(e.target.value)}
                onBlur={() => commitAttr(i)}
                onKeyDown={e => { if (e.key === 'Enter') commitAttr(i); if (e.key === 'Escape') setEditingAttr(null); }}
                className="nodrag"
                style={{
                  flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px', fontSize: 12, outline: 'none', color: 'var(--text)',
                }}
              />
            ) : (
              <span
                style={{ flex: 1, fontSize: 12, color: 'var(--text)', cursor: data.readOnly ? 'default' : 'text' }}
                onDoubleClick={() => !data.readOnly && startEditAttr(i)}
              >
                {attr}
              </span>
            )}
            {!data.readOnly && editingAttr !== i && (
              <button
                type="button"
                className="nodrag"
                onClick={() => deleteAttr(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, fontSize: 14, lineHeight: 1 }}
                title="Remove attribute"
              >×</button>
            )}
          </div>
        ))}

        {!data.readOnly && (
          <button
            type="button"
            className="nodrag"
            onClick={addAttr}
            style={{
              marginTop: 6, width: '100%', background: 'none',
              border: '1px dashed var(--border)', borderRadius: 5,
              color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: '3px 0',
            }}
          >+ Add attribute</button>
        )}
      </div>

      {/* Delete node button */}
      {!data.readOnly && (
        <button
          type="button"
          className="nodrag"
          onClick={() => data.onDelete()}
          title="Delete entity"
          style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
            width: 18, height: 18, cursor: 'pointer',
            color: '#fff', fontSize: 12, lineHeight: '18px', textAlign: 'center', padding: 0,
          }}
        >×</button>
      )}
    </div>
  );
}

// ─── Custom Edge with editable label ─────────────────────────────────────────
function LabeledEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, markerEnd, style,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(data?.label || '');

  function commit() {
    data?.onChange(draft.trim());
    setEditing(false);
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10,
          }}
        >
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
              onDoubleClick={() => !data?.readOnly && setEditing(true)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5, padding: '2px 8px',
                fontSize: 11, color: 'var(--text)',
                cursor: data?.readOnly ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                minWidth: 30, textAlign: 'center',
              }}
              title={data?.readOnly ? '' : 'Double-click to edit label'}
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

// ─── Main ErdEditor ───────────────────────────────────────────────────────────
export default function ErdEditor({ value, onChange, readOnly = false }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const initialized = useRef(false);

  // Load initial value
  useEffect(() => {
    if (initialized.current) return;
    if (value?.nodes?.length) {
      // Rehydrate node data with callbacks
      const hydratedNodes = value.nodes.map(n => ({
        ...n,
        data: { ...n.data, onChange: makeNodeonChange(n.id), onDelete: makeNodeDelete(n.id), readOnly },
      }));
      setNodes(hydratedNodes);
    }
    if (value?.edges?.length) {
      const hydratedEdges = value.edges.map(e => ({
        ...e,
        data: { ...e.data, onChange: makeEdgeLabelChange(e.id), readOnly },
      }));
      setEdges(hydratedEdges);
    }
    initialized.current = true;
  }, []); // eslint-disable-line

  // Callbacks need access to setNodes/setEdges but we also need stable refs for the node data
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  function makeNodeChange(id) {
    return (newData) => {
      setNodes(nds => nds.map(n => n.id === id
        ? { ...n, data: { ...newData, onChange: makeNodeChange(id), onDelete: makeNodeDelete(id), readOnly } }
        : n
      ));
    };
  }

  function makeNodeDelete(id) {
    return () => {
      setNodes(nds => nds.filter(n => n.id !== id));
      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    };
  }

  function makeEdgeLabelChange(id) {
    return (label) => {
      setEdges(eds => eds.map(e => e.id === id
        ? { ...e, data: { ...e.data, label, onChange: makeEdgeLabelChange(id), readOnly } }
        : e
      ));
    };
  }

  // Emit changes up
  useEffect(() => {
    if (!initialized.current || readOnly) return;
    // Strip callbacks before saving
    const cleanNodes = nodes.map(({ data: { onChange: _oc, onDelete: _od, readOnly: _ro, ...restData }, ...rest }) => ({ ...rest, data: restData }));
    const cleanEdges = edges.map(({ data: { onChange: _oc, readOnly: _ro, ...restData }, ...rest }) => ({ ...rest, data: restData }));
    onChange(cleanNodes.length === 0 && cleanEdges.length === 0 ? null : { nodes: cleanNodes, edges: cleanEdges });
  }, [nodes, edges]); // eslint-disable-line

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `e-${Date.now()}`,
      type: 'labeled',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted)' },
      style: { stroke: 'var(--muted)', strokeWidth: 2 },
      data: { label: '', onChange: null, readOnly },
    };
    setEdges(eds => {
      const added = addEdge(newEdge, eds);
      // patch onChange after we have the id
      return added.map(e => e.id === newEdge.id
        ? { ...e, data: { ...e.data, onChange: makeEdgeLabelChange(e.id) } }
        : e
      );
    });
  }, [readOnly]); // eslint-disable-line

  function addEntity(type) {
    const id = `node-${Date.now()}`;
    const meta = getEntityMeta(type);
    const newNode = {
      id,
      type: 'entity',
      position: { x: 80 + Math.random() * 300, y: 60 + Math.random() * 200 },
      data: {
        label: meta.label,
        entityType: type,
        attributes: [],
        onChange: makeNodeChange(id),
        onDelete: makeNodeDelete(id),
        readOnly: false,
      },
    };
    setNodes(nds => [...nds, newNode]);
  }

  function clearAll() {
    setNodes([]);
    setEdges([]);
  }

  if (readOnly) {
    if (!value?.nodes?.length) return null;
    return (
      <div style={{ width: '100%', height: 420, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={n => getEntityMeta(n.data?.entityType)?.color || '#6b7280'} style={{ background: 'var(--surface)' }} />
        </ReactFlow>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        padding: '10px 14px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginRight: 4 }}>Add entity:</span>
        {ENTITY_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => addEntity(t.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.color}`,
              background: 'transparent', color: t.color, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Drag entities · Connect by dragging from handle · Double-click edge label to edit
        </span>
        {(nodes.length > 0 || edges.length > 0) && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--danger)',
              background: 'transparent', color: 'var(--danger)', fontSize: 11, cursor: 'pointer',
            }}
          >Clear all</button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ width: '100%', height: 480, background: 'var(--surface2)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
        >
          <Background color="var(--border)" gap={20} />
          <Controls />
          <MiniMap nodeColor={n => getEntityMeta(n.data?.entityType)?.color || '#6b7280'} style={{ background: 'var(--surface)' }} />
        </ReactFlow>
      </div>

      {nodes.length === 0 && (
        <div style={{
          position: 'relative', marginTop: -480, height: 480, display: 'flex',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⬡</div>
            <div style={{ fontSize: 14 }}>Click an entity type above to add it to the diagram</div>
          </div>
        </div>
      )}
    </div>
  );
}
