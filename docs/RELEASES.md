# Releases and versioning

## Branch model

`main` is the integration and release branch. Work branches are short-lived:

- `feat/<description>`: feature work.
- `fix/<description>`: bug fixes.
- `release/vX.Y.Z`: release stabilization and the final version/changelog update.

Branch protection should require the `CI / quality` check for pull requests targeting `main`. Keep direct pushes disabled once the repository is ready for collaborators.

## Version model

Thessa has a web and desktop distribution. A paired release uses one version and one tag, for example `v0.2.0`; all five product manifests must use `0.2.0`.

If a **major or minor** change applies only to one distribution, its other distribution keeps its prior version. Use a component tag and a dedicated changelog section:

| Change | Example tag | Version updates |
| --- | --- | --- |
| Paired release | `v0.2.0` | web + desktop + root + Rust/Tauri config |
| Web-only major/minor | `web-v0.2.0` | root + web only; desktop remains at its current version |
| Desktop-only patch | `desktop-v0.1.1` | desktop Rust/Tauri/package manifests only |
| Web-only patch | `web-v0.1.1` | root + web only |

Patch releases may vary by distribution. Add `## Web` or `## Desktop` below the relevant version in `CHANGELOG.md` when their changes need separate notes. Never retag or mutate a published release.

## Cutting a release

1. Create `release/vX.Y.Z`, update the relevant manifests and `CHANGELOG.md`, and run `pnpm release:check`.
2. Merge the reviewed release branch into `main` after CI passes. The Release workflow recognizes a merged `release/vX.Y.Z` branch, tags that merge commit with `vX.Y.Z`, and starts the release automatically.
3. For a component release, tag the merge commit with `web-vX.Y.Z` or `desktop-vX.Y.Z`, then push the tag. Paired release tags can also be pushed manually when needed.
4. GitHub Actions validates the version, creates the GitHub Release, and for paired/desktop releases builds an Apple Silicon `.dmg` and its checksum. A release tag is immutable: the workflow refuses to point an existing tag at a different commit.

The `Release` workflow can also be run manually with the exact tag after it has been pushed. Desktop builds are intentionally unsigned until `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_ID` are configured and a notarization step is added. The attached unsigned DMG remains a usable first download.
