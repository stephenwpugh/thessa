import mermaid from 'mermaid';

export type DiagramInfo = { type: string; direction?: string };
export type RenderResult = { svg: string; diagram: DiagramInfo };
export type SourceRange = {
  from: number;
  to: number;
  line: number;
  label: string;
};

export type FlowchartNodeShape = 'rectangle' | 'round' | 'diamond';

export type FlowchartNode = {
  id: string;
  label: string;
  shape: FlowchartNodeShape;
};

export type FlowchartEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  style: '-->' | '-.->' | '==>';
};

export type FlowchartModel = {
  direction: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
};

export type FlowchartLayout = {
  version: 1;
  nodes: Record<string, { x: number; y: number }>;
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

const endpointPattern = /^([A-Za-z_][\w-]*)(?:\[(.*)\]|\((.*)\)|\{(.*)\})?$/;

function parseEndpoint(value: string): FlowchartNode | undefined {
  const match = value.trim().match(endpointPattern);
  if (!match) return undefined;

  const [, id, rectangularLabel, roundLabel, diamondLabel] = match;
  const label = rectangularLabel ?? roundLabel ?? diamondLabel ?? id;
  const shape: FlowchartNodeShape = roundLabel !== undefined ? 'round' : diamondLabel !== undefined ? 'diamond' : 'rectangle';
  return { id, label: label.trim() || id, shape };
}

/**
 * Parses the deliberately small, portable subset of Mermaid flowcharts that
 * Thessa's canvas can edit. Returning undefined protects comments, subgraphs,
 * styling directives, and other Mermaid constructs from a lossy rewrite.
 */
export function parseSupportedFlowchart(source: string): FlowchartModel | undefined {
  const lines = source.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('%%'));
  if (headerIndex < 0) return undefined;

  const header = lines[headerIndex].trim().match(/^(?:flowchart|graph)\s+([A-Za-z]+)$/i);
  if (!header) return undefined;

  const nodes = new Map<string, FlowchartNode>();
  const edges: FlowchartEdge[] = [];
  const addNode = (node: FlowchartNode) => {
    const existing = nodes.get(node.id);
    nodes.set(node.id, existing && node.label === node.id ? existing : node);
  };

  for (const rawLine of lines.slice(headerIndex + 1)) {
    const statement = rawLine.trim();
    if (!statement || statement.startsWith('%%')) continue;

    const edgeMatch = statement.match(/^(.*?)\s*(-->|-.->|==>)\s*(?:\|([^|]*)\|\s*)?(.*?)$/);
    if (edgeMatch) {
      const from = parseEndpoint(edgeMatch[1]);
      const to = parseEndpoint(edgeMatch[4]);
      if (!from || !to) return undefined;
      addNode(from);
      addNode(to);
      edges.push({ id: `edge-${edges.length + 1}`, from: from.id, to: to.id, label: edgeMatch[3]?.trim() ?? '', style: edgeMatch[2] as FlowchartEdge['style'] });
      continue;
    }

    const node = parseEndpoint(statement);
    if (!node) return undefined;
    addNode(node);
  }

  return { direction: header[1].toUpperCase(), nodes: [...nodes.values()], edges };
}

function escapeLabel(label: string): string {
  return label.replace(/[\[\]{}()|]/g, (character) => `&#${character.charCodeAt(0)};`);
}

function serializeNode(node: FlowchartNode): string {
  const label = escapeLabel(node.label);
  if (node.shape === 'round') return `${node.id}(${label})`;
  if (node.shape === 'diamond') return `${node.id}{${label}}`;
  return `${node.id}[${label}]`;
}

/** Serializes the supported model into stable, readable Mermaid source. */
export function serializeFlowchart(model: FlowchartModel): string {
  const direction = /^[A-Za-z]+$/.test(model.direction) ? model.direction.toUpperCase() : 'LR';
  const nodes = model.nodes.map((node) => `  ${serializeNode(node)}`);
  const edges = model.edges.map((edge) => `  ${edge.from} ${edge.style}${edge.label ? `|${escapeLabel(edge.label)}|` : ''} ${edge.to}`);
  return [`flowchart ${direction}`, ...nodes, ...(nodes.length && edges.length ? [''] : []), ...edges, ''].join('\n');
}

export function createFlowchartLayout(model: FlowchartModel, current?: FlowchartLayout): FlowchartLayout {
  const nodes: FlowchartLayout['nodes'] = {};
  model.nodes.forEach((node, index) => {
    nodes[node.id] = current?.nodes[node.id] ?? { x: 110 + (index % 3) * 220, y: 100 + Math.floor(index / 3) * 150 };
  });
  return { version: 1, nodes };
}

export function parseFlowchartLayout(source: string): FlowchartLayout | undefined {
  try {
    const layout = JSON.parse(source) as FlowchartLayout;
    if (layout.version !== 1 || !layout.nodes || typeof layout.nodes !== 'object') return undefined;
    if (!Object.values(layout.nodes).every((position) => typeof position?.x === 'number' && typeof position?.y === 'number')) return undefined;
    return layout;
  } catch {
    return undefined;
  }
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
