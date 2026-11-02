# Thessa architecture

## Principle

Mermaid source remains the portable document format. The editor adds a typed document model and optional metadata around that source; it does not replace Mermaid's parser or renderer.

## Package structure

```text
apps/
  web/                    Vite + React browser application
  desktop/                Tauri 2 shell and Rust native boundary

packages/
  diagram-core/           Mermaid parsing, rendering, diagnostics, metadata
  source-editor/          CodeMirror integration (next)
  editor-canvas/          Interactive graph adapter (next)
  ai-mcp/                 MCP operations and approval policy (next)

docs/
  ARCHITECTURE.md
  ROADMAP.md
```

## Runtime flow

```text
CodeMirror/source text
        │
        ▼
  diagram-core
  parse + detect + render
        │
        ├── diagnostics → editor panel
        ├── SVG → preview
        └── typed model → future interactive canvas
```

## Why two models?

Mermaid describes diagram semantics and normally lets its layout engine choose coordinates. An interactive canvas needs stable IDs, positions, handles, and selection state. The future editor model will therefore carry both Mermaid source and editor metadata.

Structured editing will initially target flowcharts, then expand to state, class, ER, and architecture diagrams. Other Mermaid types remain fully supported in faithful text/render mode.

## AI boundary

AI should return validated operations such as `add_node`, `connect_nodes`, or `change_direction`, not silently overwrite source text. A future `ai-mcp` package will validate operations, apply them to the document model, serialize Mermaid, run `mermaid.parse()`, and only then commit the change.

## Desktop boundary

The desktop app reuses the web build. Rust is reserved for filesystem access, native menus, local services, and optional local AI processes. Mermaid and the editor stay in TypeScript so browser and desktop behavior remain aligned.
