# Changelog

All notable changes to Thessa are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [1.0.0-alpha.1] - 2026-11-05

### Added

- Structured editor for the supported Mermaid flowchart subset, including a node/edge model and stable Mermaid serialization.
- Draggable flowchart canvas nodes, connect handles, and editable edge labels.
- Importable and exportable JSON sidecar files for canvas layout metadata.
- A three-pane diagram workspace with the canvas alongside a live rendered diagram and Mermaid source.
- Resizable workspace dividers, a diagramming-style shape palette, drop-to-place nodes, selection properties, and visual connection feedback.

### Notes

- This is a development prerelease. Desktop distribution remains pending Apple Developer enrollment, signing, and notarization.

## [0.2.0] - 2026-11-02

### Added

- Contributor guidance for backlog review, maintainer contact, development branches, pull requests, required checks, and releases.

## [0.1.0] - 2026-11-02

### Added

- Live Mermaid text editing, validation, and SVG preview in the web editor.
- Diagram type and direction detection.
- Shared Mermaid runtime package.
- Tauri 2 desktop application shell built from the same frontend.
- Apple Silicon macOS DMG release automation.

### Notes

- The desktop DMG is unsigned for this release. Gatekeeper may require an explicit user approval before opening it.

[0.1.0]: https://github.com/stephenwpugh/thessa/releases/tag/v0.1.0
[0.2.0]: https://github.com/stephenwpugh/thessa/releases/tag/v0.2.0
[1.0.0-alpha.1]: https://github.com/stephenwpugh/thessa/releases/tag/v1.0.0-alpha.1
