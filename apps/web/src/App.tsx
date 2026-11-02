import { useEffect, useState } from 'react';
import { detectDiagram, renderDiagram } from '@thessa/diagram-core';

const starter = `flowchart LR
  User[User] --> App[Thessa editor]
  App --> Mermaid[Mermaid.js]
  App --> AI[AI / MCP]
`;

export default function App() {
  const [source, setSource] = useState(starter);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const diagram = detectDiagram(source);

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

  return <main className="shell">
    <header className="topbar"><div><span className="mark">T</span><strong>Thessa</strong><span className="muted"> / live Mermaid editor</span></div><div className="badges"><span>{diagram.type}</span>{diagram.direction && <span>{diagram.direction}</span>}<span>{rendering ? 'rendering…' : error ? 'invalid' : 'ready'}</span></div></header>
    <section className="workspace">
      <article className="panel source-panel"><div className="panel-heading"><span>Mermaid source</span><button onClick={() => setSource(starter)}>Reset</button></div><textarea aria-label="Mermaid source" spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} /><div className="hint">Type or paste Mermaid text. Structured dragging comes next.</div></article>
      <article className="panel preview-panel"><div className="panel-heading"><span>Preview</span>{error && <span className="error-label">Parse error</span>}</div>{error ? <pre className="error">{error}</pre> : <div className="preview" dangerouslySetInnerHTML={{ __html: svg }} />}</article>
    </section>
    <footer><span>Thessa 0.1.0</span><span>Mermaid source is the portable document</span></footer>
  </main>;
}
