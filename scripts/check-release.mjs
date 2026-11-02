import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const readTomlVersion = () => {
  const cargo = readFileSync(resolve(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
  return cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
};

const rootVersion = readJson("package.json").version;
const webVersion = readJson("apps/web/package.json").version;
const desktopVersion = readJson("apps/desktop/package.json").version;
const tauriVersion = readJson("apps/desktop/src-tauri/tauri.conf.json").version;
const cargoVersion = readTomlVersion();
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

for (const [name, version] of Object.entries({ root: rootVersion, web: webVersion, desktop: desktopVersion, tauri: tauriVersion, cargo: cargoVersion })) {
  if (!version || !semver.test(version)) throw new Error(`${name} has an invalid semantic version: ${version}`);
}

if (desktopVersion !== tauriVersion || desktopVersion !== cargoVersion) {
  throw new Error("Desktop package, Cargo, and Tauri config versions must match.");
}

const tag = process.argv[2];
if (!tag) {
  if (rootVersion !== webVersion || webVersion !== desktopVersion) {
    throw new Error("Without a release tag, all product versions must match. Pass a component tag to validate a divergent release.");
  }
  console.log(`Release manifests are aligned at ${rootVersion}.`);
  process.exit(0);
}

const match = tag.match(/^(?:(web|desktop)-)?v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
if (!match) throw new Error(`Unsupported release tag: ${tag}`);
const [, component, version] = match;

if (!component && [rootVersion, webVersion, desktopVersion].some((candidate) => candidate !== version)) {
  throw new Error(`Paired tag ${tag} requires all product manifests to be ${version}.`);
}
if (component === "web" && (rootVersion !== version || webVersion !== version)) {
  throw new Error(`Web tag ${tag} requires root and web manifests to be ${version}.`);
}
if (component === "desktop" && desktopVersion !== version) {
  throw new Error(`Desktop tag ${tag} requires desktop manifests to be ${version}.`);
}

console.log(`${tag} is valid (${component ?? "paired"} release).`);
