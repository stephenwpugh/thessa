# Contributing to Thessa

Thanks for helping improve Thessa. This guide covers the usual path for proposing, discussing, and submitting changes.

## Before you start

1. Read the [roadmap](./docs/ROADMAP.md) and [architecture](./docs/ARCHITECTURE.md) to understand the current direction.
2. Search [open and closed issues](https://github.com/stephenwpugh/thessa/issues) before creating a new one. This avoids splitting discussion or duplicating work.
3. For a substantial feature, design change, or question about priorities, open an issue first and ask for maintainer direction. Please do not begin a large implementation until the approach is agreed.

## Issues and contacting the maintainer

Use a GitHub issue for bug reports, feature ideas, roadmap questions, and contributor coordination. Include a clear title, the expected and actual behavior for bugs, reproducible steps when possible, and relevant environment details.

For a private security report or another matter that should not be public, contact the repository owner, [@stephenwpugh](https://github.com/stephenwpugh), through GitHub rather than opening an issue with sensitive details.

## Development workflow

1. Fork the repository and create a short-lived branch from `main`:
   - `feat/<description>` for user-facing work
   - `fix/<description>` for bug fixes
   - `release/vX.Y.Z` for release stabilization
2. Keep each pull request focused on one concern.
3. Add or update documentation when behavior, workflow, or product scope changes.
4. Run the required checks from the repository root before opening a pull request:

   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   pnpm build
   pnpm release:check
   ```

## Pull requests

Open pull requests against `main`. In the description, explain what changed, link the relevant issue, and call out testing, user-visible effects, and any follow-up work. Keep the pull request current with `main`, respond to review feedback, and wait for CI and maintainer approval before merging.

Do not commit directly to `main`, include unrelated formatting churn, add secrets, or reuse a release tag.

## Releases

Versioning and release branches follow the [release policy](./docs/RELEASES.md). In particular, a paired major or minor release updates the root, web, desktop, Cargo, and Tauri manifest versions together and has matching changelog notes.
