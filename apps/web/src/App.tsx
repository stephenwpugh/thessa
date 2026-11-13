import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import {
  createFlowchartLayout,
  detectDiagram,
  getSourceRanges,
  parseFlowchartLayout,
  parseSupportedFlowchart,
  renderDiagram,
  serializeFlowchart,
  sourceRangeAt,
  type FlowchartLayout,
  type FlowchartModel,
  type SourceRange,
} from '@thessa/diagram-core';

const starter = `flowchart LR
  User[User] --> App[Thessa editor]
  App --> Mermaid[Mermaid.js]
  App --> AI[AI / MCP]
`;

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange: (position: number) => void;
  onReady: (view: EditorView) => void;
};

function SourceEditor({ value, onChange, onSelectionChange, onReady }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const selectionRef = useRef(onSelectionChange);
  changeRef.current = onChange;
  selectionRef.current = onSelectionChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          markdown(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.theme({
            '&': { height: '100%', color: '#d7e2d3', backgroundColor: '#101216', fontSize: '14px' },
            '.cm-content': { fontFamily: "'SFMono-Regular', Consolas, monospace", padding: '18px 0' },
            '.cm-gutters': { color: '#687083', backgroundColor: '#101216', border: 'none' },
            '.cm-activeLine': { backgroundColor: '#1a1e27' },
            '.cm-activeLineGutter': { backgroundColor: '#1a1e27', color: '#b7c4d7' },
            '.cm-cursor': { borderLeftColor: '#a6e3a1' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#36514a' },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) selectionRef.current(update.state.selection.main.head);
          }),
        ],
      }),
      parent: host.current,
    });
    view.current = editor;
    onReady(editor);
    return () => editor.destroy();
  // CodeMirror is created once; refs keep the callbacks current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="code-editor" ref={host} aria-label="Mermaid source editor" />;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type CanvasProps = {
  model: FlowchartModel;
  layout: FlowchartLayout;
  onLayoutChange: (layout: FlowchartLayout) => void;
  onModelChange: (model: FlowchartModel) => void;
  onAddNode: (shape: FlowchartModel['nodes'][number]['shape'], position?: { x: number; y: number }) => void;
};

const canvasWidth = 1200;
const canvasHeight = 800;

function FlowchartCanvas({ model, layout, onLayoutChange, onModelChange, onAddNode }: CanvasProps) {
  const drag = useRef<{ id: string; offsetX: number; offsetY: number } | undefined>(undefined);
  const [connecting, setConnecting] = useState<string>();
  const [pointer, setPointer] = useState<{ x: number; y: number }>();
  const [selected, setSelected] = useState<string>();
  const canvas = useRef<SVGSVGElement>(null);
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const pointAt = (clientX: number, clientY: number, target = canvas.current) => {
    const bounds = target?.getBoundingClientRect();
    if (!bounds) return { x: canvasWidth / 2, y: canvasHeight / 2 };
    return { x: (clientX - bounds.left) * (canvasWidth / bounds.width), y: (clientY - bounds.top) * (canvasHeight / bounds.height) };
  };
  const clampPoint = (point: { x: number; y: number }) => ({ x: Math.max(92, Math.min(canvasWidth - 92, point.x)), y: Math.max(52, Math.min(canvasHeight - 52, point.y)) });
  const moveNode = (event: React.PointerEvent<SVGSVGElement>) => {
    const activeDrag = drag.current;
    setPointer(pointAt(event.clientX, event.clientY, event.currentTarget));
    if (!activeDrag) return;
    const point = pointAt(event.clientX, event.clientY, event.currentTarget);
    const previous = layout.nodes[activeDrag.id];
    if (!previous) return;
    onLayoutChange({ ...layout, nodes: { ...layout.nodes, [activeDrag.id]: clampPoint({ x: point.x - activeDrag.offsetX, y: point.y - activeDrag.offsetY }) } });
  };
  const beginNodeDrag = (event: React.PointerEvent<SVGGElement>, id: string) => {
    const position = layout.nodes[id];
    if (!position || event.button !== 0) return;
    event.stopPropagation();
    const point = pointAt(event.clientX, event.clientY);
    setSelected(id);
    drag.current = { id, offsetX: point.x - position.x, offsetY: point.y - position.y };
    canvas.current?.setPointerCapture(event.pointerId);
  };
  const createEdge = (from: string, to: string) => {
    if (from === to || model.edges.some((edge) => edge.from === from && edge.to === to)) return;
    onModelChange({ ...model, edges: [...model.edges, { id: `edge-${crypto.randomUUID()}`, from, to, label: '', style: '-->' }] });
  };
  const updateEdgeLabel = (edgeId: string, label: string) => onModelChange({ ...model, edges: model.edges.map((edge) => edge.id === edgeId ? { ...edge, label } : edge) });
  const updateSelected = (changes: Partial<FlowchartModel['nodes'][number]>) => {
    if (!selected) return;
    onModelChange({ ...model, nodes: model.nodes.map((node) => node.id === selected ? { ...node, ...changes } : node) });
  };
  const deleteSelected = () => {
    if (!selected) return;
    onModelChange({ ...model, nodes: model.nodes.filter((node) => node.id !== selected), edges: model.edges.filter((edge) => edge.from !== selected && edge.to !== selected) });
    setSelected(undefined);
  };
  const connector = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: from.x + (dx >= 0 ? 78 : -78), y: from.y };
    return { x: from.x, y: from.y + (dy >= 0 ? 38 : -38) };
  };
  const addAtDrop = (event: React.DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const shape = event.dataTransfer.getData('application/x-thessa-shape') as FlowchartModel['nodes'][number]['shape'];
    if (shape === 'rectangle' || shape === 'round' || shape === 'diamond') onAddNode(shape, clampPoint(pointAt(event.clientX, event.clientY, event.currentTarget)));
  };

  return <div className="flowchart-canvas-wrap">
    <div className="canvas-toolbar" aria-label="Shape palette">
      <span className="canvas-toolbar-title">Shapes</span>
      {(['rectangle', 'round', 'diamond'] as const).map((shape) => <button key={shape} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-thessa-shape', shape); }} onClick={() => onAddNode(shape)} title={`Drag a ${shape} to the canvas, or click to add one`}><span className={`shape-icon ${shape}`} />{shape === 'rectangle' ? 'Process' : shape === 'round' ? 'Start / end' : 'Decision'}</button>)}
      <span className="canvas-toolbar-help">Drag shapes onto the canvas. Drag nodes to move them; click an output handle, then an input handle, to connect.</span>
    </div>
    {selectedNode && <aside className="node-inspector" aria-label="Selected node properties">
      <div><strong>Selected node</strong><button onClick={() => setSelected(undefined)} aria-label="Close node properties">×</button></div>
      <label>Label<input value={selectedNode.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
      <label>Shape<select value={selectedNode.shape} onChange={(event) => updateSelected({ shape: event.target.value as FlowchartModel['nodes'][number]['shape'] })}><option value="rectangle">Process</option><option value="round">Start / end</option><option value="diamond">Decision</option></select></label>
      <button className="danger" onClick={deleteSelected}>Delete node</button>
    </aside>}
    <svg ref={canvas} className="flowchart-canvas" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} onPointerMove={moveNode} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onPointerDown={() => setSelected(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={addAtDrop}>
      <defs><marker id="thessa-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" /></marker></defs>
      <pattern id="thessa-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" /></pattern>
      <rect className="canvas-grid" width={canvasWidth} height={canvasHeight} fill="url(#thessa-grid)" />
      {model.edges.map((edge) => {
        const from = layout.nodes[edge.from];
        const to = layout.nodes[edge.to];
        if (!from || !to) return null;
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const fromPoint = connector(from, to);
        const toPoint = connector(to, from);
        return <g className="canvas-edge" key={edge.id}>
          <line x1={fromPoint.x} y1={fromPoint.y} x2={toPoint.x} y2={toPoint.y} markerEnd="url(#thessa-arrow)" />
          <foreignObject x={midpoint.x - 57} y={midpoint.y - 17} width="114" height="34"><input aria-label={`Label for ${edge.from} to ${edge.to}`} value={edge.label} placeholder="Add label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateEdgeLabel(edge.id, event.target.value)} /></foreignObject>
        </g>;
      })}
      {connecting && pointer && layout.nodes[connecting] && <line className="connection-preview" x1={layout.nodes[connecting].x + 78} y1={layout.nodes[connecting].y} x2={pointer.x} y2={pointer.y} />}
      {model.nodes.map((node) => {
        const position = layout.nodes[node.id];
        if (!position) return null;
        const isConnecting = connecting === node.id;
        const labelLines = node.label.split(/\\n/).slice(0, 2);
        return <g className={`canvas-node${selected === node.id ? ' selected' : ''}`} key={node.id} transform={`translate(${position.x} ${position.y})`} onPointerDown={(event) => beginNodeDrag(event, node.id)}>
          {node.shape === 'diamond'
            ? <path className="node-body" d="M0,-43 L76,0 L0,43 L-76,0 Z" />
            : <rect className="node-body" x="-76" y="-31" width="152" height="62" rx={node.shape === 'round' ? 31 : 8} />}
          <circle className="connect-handle input-handle" cx="-76" cy="0" r="8" aria-label={`Connect to ${node.label}`} onPointerDown={(event) => { event.stopPropagation(); if (connecting) { createEdge(connecting, node.id); setConnecting(undefined); } }} />
          <circle className={`connect-handle output-handle${isConnecting ? ' connecting' : ''}`} cx="76" cy="0" r="8" aria-label={`Connect from ${node.label}`} onPointerDown={(event) => { event.stopPropagation(); setConnecting(node.id); }} />
          <text textAnchor="middle" className="node-label">{labelLines.map((line, index) => <tspan x="0" dy={index === 0 ? `${labelLines.length === 1 ? 5 : -5}` : '15'} key={line}>{line}</tspan>)}</text>
        </g>;
      })}
    </svg>
    {connecting && <div className="connect-status">Connecting from <strong>{nodeById.get(connecting)?.label}</strong> — select a node’s left handle.</div>}
  </div>;
}

export default function App() {
  const [source, setSource] = useState(starter);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeRange, setActiveRange] = useState<SourceRange>();
  const [notice, setNotice] = useState('');
  const [layout, setLayout] = useState<FlowchartLayout>({ version: 1, nodes: {} });
  const [canvasWidth, setCanvasWidth] = useState(52);
  const [previewHeight, setPreviewHeight] = useState(54);
  const editor = useRef<EditorView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const layoutInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | undefined>(undefined);
  const resizeStart = useRef<{ kind: 'canvas' | 'preview'; x: number; y: number; value: number } | undefined>(undefined);
  const diagram = detectDiagram(source);
  const ranges = useMemo(() => getSourceRanges(source), [source]);
  const flowchart = useMemo(() => parseSupportedFlowchart(source), [source]);

  useEffect(() => {
    if (flowchart) setLayout((current) => createFlowchartLayout(flowchart, current));
  }, [flowchart]);

  useEffect(() => {
    let active = true;
    setRendering(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await renderDiagram(source);
        if (active) { setSvg(result.svg); setError(''); }
      } catch (renderError) {
        if (active) { setError(renderError instanceof Error ? renderError.message : 'Unable to render diagram'); setSvg(''); }
      } finally { if (active) setRendering(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source]);

  const selectRange = useCallback((range: SourceRange) => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: range.from, head: range.to }, scrollIntoView: true });
    view.focus();
    setActiveRange(range);
  }, []);

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setNotice('Source copied');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = source;
      document.body.append(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      setNotice('Source copied');
    }
  };

  const saveSource = async () => {
    type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (contents: string) => Promise<void>; close: () => Promise<void> }> }>;
    const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    try {
      if (picker) {
        const handle = await picker({ suggestedName: 'diagram.mmd', types: [{ description: 'Mermaid diagram', accept: { 'text/plain': ['.mmd', '.mermaid', '.txt'] } }] });
        const writable = await handle.createWritable();
        await writable.write(source);
        await writable.close();
      } else {
        download('diagram.mmd', source, 'text/plain;charset=utf-8');
      }
      setNotice('Source saved');
    } catch (saveError) {
      if ((saveError as DOMException).name !== 'AbortError') setNotice('Could not save source');
    }
  };

  const openSource = async (file?: File) => {
    if (!file) return;
    setSource(await file.text());
    setNotice(`Opened ${file.name}`);
  };

  const importLayout = async (file?: File) => {
    if (!file) return;
    const imported = parseFlowchartLayout(await file.text());
    if (!imported || !flowchart) { setNotice('That is not a Thessa layout file'); return; }
    setLayout(createFlowchartLayout(flowchart, imported));
    setNotice('Layout loaded');
  };

  const exportLayout = () => {
    if (!flowchart) return;
    download('thessa-layout.json', `${JSON.stringify(createFlowchartLayout(flowchart, layout), null, 2)}\n`, 'application/json');
    setNotice('Layout saved');
  };

  const updateFlowchart = (model: FlowchartModel) => {
    setSource(serializeFlowchart(model));
    setLayout((current) => createFlowchartLayout(model, current));
  };

  const addNode = (shape: FlowchartModel['nodes'][number]['shape'] = 'rectangle', position?: { x: number; y: number }) => {
    if (!flowchart) return;
    let number = flowchart.nodes.length + 1;
    let id = `Node${number}`;
    while (flowchart.nodes.some((node) => node.id === id)) { number += 1; id = `Node${number}`; }
    const next = { ...flowchart, nodes: [...flowchart.nodes, { id, label: `New ${shape === 'diamond' ? 'decision' : 'node'}`, shape }] };
    setSource(serializeFlowchart(next));
    setLayout((current) => {
      const arranged = createFlowchartLayout(next, current);
      return position ? { ...arranged, nodes: { ...arranged.nodes, [id]: position } } : arranged;
    });
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (start) setPan({ x: start.panX + event.clientX - start.x, y: start.panY + event.clientY - start.y });
  };
  const endPan = () => { dragStart.current = undefined; };
  const beginResize = (kind: 'canvas' | 'preview', event: React.PointerEvent<HTMLDivElement>) => {
    const current = kind === 'canvas' ? canvasWidth : previewHeight;
    resizeStart.current = { kind, x: event.clientX, y: event.clientY, value: current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    const bounds = workspace.current?.getBoundingClientRect();
    if (!start || !bounds) return;
    const change = start.kind === 'canvas' ? (event.clientX - start.x) / bounds.width * 100 : (event.clientY - start.y) / bounds.height * 100;
    if (start.kind === 'canvas') setCanvasWidth(Math.max(30, Math.min(70, start.value + change)));
    else setPreviewHeight(Math.max(28, Math.min(72, start.value + change)));
  };
  const endResize = () => { resizeStart.current = undefined; };

  return <main className="shell">
    <header className="topbar"><div><span className="mark">T</span><strong>Thessa</strong><span className="muted"> / diagram workspace</span></div><div className="badges"><span>{diagram.type}</span>{diagram.direction && <span>{diagram.direction}</span>}<span>{rendering ? 'rendering…' : error ? 'invalid' : 'ready'}</span></div></header>
    <section ref={workspace} className="workspace" style={{ '--canvas-width': `${canvasWidth}%`, '--preview-height': `${previewHeight}%` } as React.CSSProperties}>
      <article className="panel canvas-panel">
        <div className="panel-heading"><span>Diagram canvas</span><div className="actions"><button onClick={() => addNode()} disabled={!flowchart}>Add node</button><button onClick={exportLayout} disabled={!flowchart}>Save layout</button><button onClick={() => layoutInput.current?.click()} disabled={!flowchart}>Load layout</button></div></div>
        <input ref={layoutInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { void importLayout(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        {flowchart ? <FlowchartCanvas model={flowchart} layout={layout} onLayoutChange={setLayout} onModelChange={updateFlowchart} onAddNode={addNode} /> : <div className="canvas-unavailable"><strong>Canvas available for simple flowcharts</strong><span>Use a <code>flowchart LR</code> or <code>flowchart TD</code> diagram with nodes and edges to edit it here. Your Mermaid source remains safe and editable below.</span></div>}
      </article>
      <div className="splitter vertical-splitter" role="separator" aria-orientation="vertical" aria-label="Resize canvas" onPointerDown={(event) => beginResize('canvas', event)} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} />
      <section className="right-workspace">
        <article className="panel preview-panel">
          <div className="panel-heading"><span>Rendered diagram</span><div className="actions"><button onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))} aria-label="Zoom out">−</button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))} aria-label="Zoom in">+</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button><button disabled={!svg} onClick={() => download('thessa-diagram.svg', svg, 'image/svg+xml')}>Export SVG</button>{error && <span className="error-label">Parse error</span>}</div></div>
          {error ? <pre className="error">{error}</pre> : <div className="preview" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}><div className="diagram-canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} dangerouslySetInnerHTML={{ __html: svg }} /></div>}
        </article>
        <div className="splitter horizontal-splitter" role="separator" aria-orientation="horizontal" aria-label="Resize rendered diagram and Mermaid source" onPointerDown={(event) => beginResize('preview', event)} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} />
        <article className="panel source-panel">
          <div className="panel-heading"><span>Mermaid source</span><div className="actions"><button onClick={() => fileInput.current?.click()}>Open</button><button onClick={saveSource}>Save</button><button onClick={copySource}>Copy</button><button onClick={() => setSource(starter)}>Reset</button></div></div>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".mmd,.mermaid,.txt,text/plain" onChange={(event) => { void openSource(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <SourceEditor value={source} onChange={setSource} onReady={(view) => { editor.current = view; }} onSelectionChange={(position) => setActiveRange(sourceRangeAt(ranges, position))} />
        <div className="source-map"><span>{activeRange ? `Line ${activeRange.line}` : `${ranges.length} mapped statements`}</span>{activeRange && <button onClick={() => selectRange(activeRange)} title="Select mapped source">{activeRange.label}</button>}</div>
        <div className="hint">CodeMirror editor · select a statement to inspect its source range.</div>
        </article>
      </section>
    </section>
    <footer><span>Thessa 1.0.0-alpha.1</span><span>{notice || 'Mermaid source is the portable document'}</span></footer>
  </main>;
}
