import mermaid from 'mermaid';

export type DiagramInfo = { type: string; direction?: string };
export type RenderResult = { svg: string; diagram: DiagramInfo };
export type SourceRange = {
  from: number;
  to: number;
  line: number;
  label: string;
};

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

/**
 * Returns the editable Mermaid statements and their offsets in the document.
 * The ranges deliberately preserve the original source rather than trying to
 * reverse-map Mermaid's generated SVG, which does not retain source locations.
 */
export function getSourceRanges(source: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  let from = 0;
  const lines = source.split(/\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const statement = raw.trim();
    const lineEnd = from + raw.length;
    const isDirective = statement.startsWith('%%') || statement === '---' || statement === '';
    const isDeclaration = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|xychart(?:-beta)?|block-beta|architecture-beta|requirementDiagram|C4Context|zenuml)\b/i.test(statement);

    if (!isDirective && !isDeclaration) {
      ranges.push({ from, to: lineEnd, line: index + 1, label: statement.slice(0, 80) });
    }
    from = lineEnd + 1;
  }
  return ranges;
}

export function sourceRangeAt(ranges: SourceRange[], position: number): SourceRange | undefined {
  return ranges.find((range) => position >= range.from && position <= range.to)
    ?? ranges.find((range) => position < range.from)
    ?? ranges.at(-1);
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
