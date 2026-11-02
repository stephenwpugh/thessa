# Thessa development guide

## Repository map

- `apps/web`: Vite, React, and TypeScript web editor.
- `apps/desktop`: Tauri 2 shell over the web editor.
- `packages/diagram-core`: shared Mermaid runtime.
- `docs`: product and release documentation.

## Required checks

Run these from the repository root before opening a pull request or cutting a release:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm release:check
```

Use `pnpm tauri:build` on an Apple Silicon Mac to produce the desktop `.dmg` locally.

## Branches and pull requests

`main` is always releasable. Never commit directly to it. Use short-lived branches with one of these prefixes:

- `feat/<description>` for user-facing capability work.
- `fix/<description>` for bug fixes.
- `release/vX.Y.Z` to stabilize a paired release.

Open a pull request into `main`; CI must pass before merge. Do not reuse a release tag.

## Versions and releases

The current paired release is `v0.1.0`. For a paired major/minor release, keep these versions equal: root `package.json`, `apps/web/package.json`, `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/src-tauri/tauri.conf.json`.

When a major/minor feature ships only on web, advance the root and web versions but retain the previous desktop version. Use a `web-vX.Y.Z` tag and add a web-only section to `CHANGELOG.md`. The equivalent applies to desktop-only patch releases with `desktop-vX.Y.Z`; patch versions may therefore differ. See `docs/RELEASES.md` before changing a version.

The release workflow validates the tagged component, builds the Apple Silicon DMG for desktop releases, and attaches it plus SHA-256 checksums to the GitHub Release. Do not add signing credentials to the repository; configure them as GitHub Actions secrets when certificates and notarization are available.
