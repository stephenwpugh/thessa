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
};

function FlowchartCanvas({ model, layout, onLayoutChange, onModelChange }: CanvasProps) {
  const drag = useRef<{ id: string; offsetX: number; offsetY: number } | undefined>(undefined);
  const [connecting, setConnecting] = useState<string>();
  const canvas = useRef<SVGSVGElement>(null);
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const pointAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (900 / bounds.width), y: (event.clientY - bounds.top) * (600 / bounds.height) };
  };
  const moveNode = (event: React.PointerEvent<SVGSVGElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag) return;
    const point = pointAt(event);
    const previous = layout.nodes[activeDrag.id];
    if (!previous) return;
    onLayoutChange({ ...layout, nodes: { ...layout.nodes, [activeDrag.id]: { x: Math.max(85, Math.min(815, point.x - activeDrag.offsetX)), y: Math.max(45, Math.min(555, point.y - activeDrag.offsetY)) } } });
  };
  const beginNodeDrag = (event: React.PointerEvent<SVGGElement>, id: string) => {
    const position = layout.nodes[id];
    if (!position || event.button !== 0) return;
    event.stopPropagation();
    const bounds = canvas.current?.getBoundingClientRect();
    if (!bounds) return;
    drag.current = { id, offsetX: ((event.clientX - bounds.left) * 900 / bounds.width) - position.x, offsetY: ((event.clientY - bounds.top) * 600 / bounds.height) - position.y };
    canvas.current?.setPointerCapture(event.pointerId);
  };
  const createEdge = (from: string, to: string) => {
    if (from === to || model.edges.some((edge) => edge.from === from && edge.to === to)) return;
    onModelChange({ ...model, edges: [...model.edges, { id: `edge-${crypto.randomUUID()}`, from, to, label: '', style: '-->' }] });
  };
  const updateEdgeLabel = (edgeId: string, label: string) => onModelChange({ ...model, edges: model.edges.map((edge) => edge.id === edgeId ? { ...edge, label } : edge) });

  return <div className="flowchart-canvas-wrap">
    <div className="canvas-instructions">Drag nodes to arrange them. Select an output handle, then an input handle, to connect nodes.</div>
    <svg ref={canvas} className="flowchart-canvas" viewBox="0 0 900 600" onPointerMove={moveNode} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
      <defs><marker id="thessa-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" /></marker></defs>
      {model.edges.map((edge) => {
        const from = layout.nodes[edge.from];
        const to = layout.nodes[edge.to];
        if (!from || !to) return null;
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        return <g className="canvas-edge" key={edge.id}>
          <line x1={from.x + 76} y1={from.y} x2={to.x - 76} y2={to.y} markerEnd="url(#thessa-arrow)" />
          <foreignObject x={midpoint.x - 57} y={midpoint.y - 17} width="114" height="34"><input aria-label={`Label for ${edge.from} to ${edge.to}`} value={edge.label} placeholder="Add label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateEdgeLabel(edge.id, event.target.value)} /></foreignObject>
        </g>;
      })}
      {model.nodes.map((node) => {
        const position = layout.nodes[node.id];
        if (!position) return null;
        const isConnecting = connecting === node.id;
        const labelLines = node.label.split(/\\n/).slice(0, 2);
        return <g className="canvas-node" key={node.id} transform={`translate(${position.x} ${position.y})`} onPointerDown={(event) => beginNodeDrag(event, node.id)}>
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
  const [previewMode, setPreviewMode] = useState<'rendered' | 'canvas'>('rendered');
  const [layout, setLayout] = useState<FlowchartLayout>({ version: 1, nodes: {} });
  const editor = useRef<EditorView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const layoutInput = useRef<HTMLInputElement>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | undefined>(undefined);
  const diagram = detectDiagram(source);
  const ranges = useMemo(() => getSourceRanges(source), [source]);
  const flowchart = useMemo(() => parseSupportedFlowchart(source), [source]);

  useEffect(() => {
    if (flowchart) setLayout((current) => createFlowchartLayout(flowchart, current));
    else setPreviewMode('rendered');
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

  const addNode = () => {
    if (!flowchart) return;
    let number = flowchart.nodes.length + 1;
    let id = `Node${number}`;
    while (flowchart.nodes.some((node) => node.id === id)) { number += 1; id = `Node${number}`; }
    updateFlowchart({ ...flowchart, nodes: [...flowchart.nodes, { id, label: 'New node', shape: 'rectangle' }] });
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

  return <main className="shell">
    <header className="topbar"><div><span className="mark">T</span><strong>Thessa</strong><span className="muted"> / live Mermaid editor</span></div><div className="badges"><span>{diagram.type}</span>{diagram.direction && <span>{diagram.direction}</span>}<span>{rendering ? 'rendering…' : error ? 'invalid' : 'ready'}</span></div></header>
    <section className="workspace">
      <article className="panel source-panel">
        <div className="panel-heading"><span>Mermaid source</span><div className="actions"><button onClick={() => fileInput.current?.click()}>Open</button><button onClick={saveSource}>Save</button><button onClick={copySource}>Copy</button><button onClick={() => setSource(starter)}>Reset</button></div></div>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".mmd,.mermaid,.txt,text/plain" onChange={(event) => { void openSource(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <SourceEditor value={source} onChange={setSource} onReady={(view) => { editor.current = view; }} onSelectionChange={(position) => setActiveRange(sourceRangeAt(ranges, position))} />
        <div className="source-map"><span>{activeRange ? `Line ${activeRange.line}` : `${ranges.length} mapped statements`}</span>{activeRange && <button onClick={() => selectRange(activeRange)} title="Select mapped source">{activeRange.label}</button>}</div>
        <div className="hint">CodeMirror editor · select a statement to inspect its source range.</div>
      </article>
      <article className="panel preview-panel">
        <div className="panel-heading"><span>{previewMode === 'canvas' ? 'Flowchart canvas' : 'Preview'}</span><div className="actions"><button className={previewMode === 'rendered' ? 'active' : ''} onClick={() => setPreviewMode('rendered')}>Preview</button><button className={previewMode === 'canvas' ? 'active' : ''} disabled={!flowchart} onClick={() => setPreviewMode('canvas')}>Canvas</button>{previewMode === 'canvas' && <><button onClick={addNode}>Add node</button><button onClick={exportLayout}>Save layout</button><button onClick={() => layoutInput.current?.click()}>Load layout</button></>}{previewMode === 'rendered' && <><button onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))} aria-label="Zoom out">−</button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))} aria-label="Zoom in">+</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button><button disabled={!svg} onClick={() => download('thessa-diagram.svg', svg, 'image/svg+xml')}>Export SVG</button></>}{error && <span className="error-label">Parse error</span>}</div></div>
        <input ref={layoutInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { void importLayout(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        {previewMode === 'canvas' && flowchart ? <FlowchartCanvas model={flowchart} layout={layout} onLayoutChange={setLayout} onModelChange={updateFlowchart} /> : error ? <pre className="error">{error}</pre> : <div className="preview" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}><div className="diagram-canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} dangerouslySetInnerHTML={{ __html: svg }} /></div>}
      </article>
    </section>
    <footer><span>Thessa 0.2.0</span><span>{notice || 'Mermaid source is the portable document'}</span></footer>
  </main>;
}
