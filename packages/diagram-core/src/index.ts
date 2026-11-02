import mermaid from 'mermaid';

export type DiagramInfo = { type: string; direction?: string };
export type RenderResult = { svg: string; diagram: DiagramInfo };

let configured = false;

function configure() {
  if (configured) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
  configured = true;
}

export function detectDiagram(source: string): DiagramInfo {
  const firstMeaningfulLine = source.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('%%') && !line.startsWith('---')) ?? '';
  const match = firstMeaningfulLine.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|xychart(?:-beta)?|block-beta|architecture-beta|requirementDiagram|C4Context|zenuml)\b(?:\s+([A-Z]+))?/i);
  return { type: match?.[1] ?? 'unknown', direction: match?.[2]?.toUpperCase() };
}

export async function validateDiagram(source: string): Promise<DiagramInfo> {
  configure();
  const parsed = await mermaid.parse(source, { suppressErrors: false });
  return { type: parsed.diagramType, direction: detectDiagram(source).direction };
}

export async function renderDiagram(source: string, id = 'thessa-diagram'): Promise<RenderResult> {
  configure();
  const diagram = await validateDiagram(source);
  const rendered = await mermaid.render(id, source);
  return { svg: rendered.svg, diagram };
}
