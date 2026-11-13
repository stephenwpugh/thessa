#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <app-path> <dmg-path>" >&2
  exit 2
fi

app_path="$1"
dmg_path="$2"
if [ ! -d "$app_path" ] || [ -e "$dmg_path" ]; then
  echo "App must exist and DMG must not already exist: $app_path -> $dmg_path" >&2
  exit 1
fi

mkdir -p "$(dirname "$dmg_path")"
dmg_path="$(cd "$(dirname "$dmg_path")" && pwd)/$(basename "$dmg_path")"
work_dir="$(mktemp -d /tmp/thessa-dmg.XXXXXX)"
mount_dir="$work_dir/mount"
mounted=false
cleanup() {
  if [ "$mounted" = true ]; then
    if ! diskutil eject "$mount_dir"; then
      echo "Could not eject $mount_dir; leaving temporary files in place." >&2
      return
    fi
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT
mkdir -p "$work_dir/stage" "$mount_dir"
ditto "$app_path" "$work_dir/stage/Thessa.app"
codesign --force --sign - "$work_dir/stage/Thessa.app"
codesign --verify --deep --strict --verbose=2 "$work_dir/stage/Thessa.app"
ln -s /Applications "$work_dir/stage/Applications"
hdiutil create -volname "Thessa Installer" -srcfolder "$work_dir/stage" -format UDZO "$dmg_path"
hdiutil attach -readonly -nobrowse -mountpoint "$mount_dir" "$dmg_path"
mounted=true
codesign --verify --deep --strict --verbose=2 "$mount_dir/Thessa.app"
test "$(readlink "$mount_dir/Applications")" = /Applications
diskutil eject "$mount_dir"
mounted=false
