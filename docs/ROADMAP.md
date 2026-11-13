# Roadmap

## 0.1 — rendering proof of concept

- [x] Type Mermaid source
- [x] Validate and render SVG
- [x] Detect diagram type and direction
- [x] Shared package boundary
- [x] Tauri shell scaffold

## 0.2 — editor foundations

- [x] CodeMirror 6 source editor
- [x] Source-range mapping and text selection
- [x] Zoom/pan preview controls
- [x] Export SVG and copy source
- [x] Local file open/save

## 1.0 prerelease — visual diagram workspace

- [x] Internal node/edge model
- [x] Flowchart canvas with draggable nodes
- [x] Connect handles and edge labels
- [x] Mermaid serializer for supported flowcharts
- [x] Sidecar layout metadata
- [x] Persistent three-pane workspace: canvas left, render above Mermaid source on the right
- [x] Resizable canvas/render/source panes
- [x] Canvas shape palette with click-to-add and drag-to-place nodes
- [x] Node selection, label/shape editing, deletion, and click-to-connect handles

> This is development-ready functionality while the desktop distribution remains blocked on Apple Developer enrollment and signing/notarization.

## 0.4 — AI and collaboration

- [ ] MCP operation schemas
- [ ] Local desktop MCP bridge
- [ ] Approval UI for AI changes
- [ ] Explain selected node/edge
- [ ] Optional Yjs collaboration
