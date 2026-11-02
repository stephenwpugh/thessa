# Thessa

Thessa is a live Mermaid diagram editor. It keeps Mermaid text as the portable source of truth while adding an interactive editor around it.

## First version

- Live Mermaid validation and SVG rendering
- Code editor and preview side by side
- Diagram type and direction detection
- Web app scaffolded with Vite, React, and TypeScript
- Shared Mermaid runtime package
- Tauri 2 desktop proof of concept using the same frontend

## Run it

```bash
pnpm install
pnpm dev
```

The web app is available at `http://localhost:5173`.

Build the web app:

```bash
pnpm build
```

The desktop proof of concept requires Rust and the Tauri CLI:

```bash
pnpm tauri:dev
```

## Project documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Release and versioning policy](./docs/RELEASES.md)
- [Changelog](./CHANGELOG.md)

## Downloads

Published desktop installers are attached to each [GitHub Release](https://github.com/stephenwpugh/thessa/releases). The first supported installer is an unsigned Apple Silicon (`arm64`) `.dmg`; macOS may require the user to explicitly allow it in Privacy & Security until code signing and notarization are configured.

## License

MIT. See [LICENSE](./LICENSE).
