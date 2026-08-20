#!/bin/zsh
set -euo pipefail

PACKAGE_DIR="${0:A:h:h}"
REPOSITORY_ROOT="${PACKAGE_DIR:h:h}"
RESOURCE_DIR="$PACKAGE_DIR/Resources"
ICONSET_DIR="$PACKAGE_DIR/.build/AppIcon.iconset"
SOURCE_PNG="$PACKAGE_DIR/.build/AppIcon-1024.png"

/bin/rm -rf "$ICONSET_DIR"
/bin/mkdir -p "$ICONSET_DIR"

/usr/bin/xcrun swift "$PACKAGE_DIR/scripts/generate-icon.swift" \
  "$REPOSITORY_ROOT/public/favicon.svg" \
  "$SOURCE_PNG"

for spec in \
  "16 icon_16x16.png" \
  "32 icon_16x16@2x.png" \
  "32 icon_32x32.png" \
  "64 icon_32x32@2x.png" \
  "128 icon_128x128.png" \
  "256 icon_128x128@2x.png" \
  "256 icon_256x256.png" \
  "512 icon_256x256@2x.png" \
  "512 icon_512x512.png" \
  "1024 icon_512x512@2x.png"
do
  size="${spec%% *}"
  name="${spec#* }"
  /usr/bin/sips -z "$size" "$size" "$SOURCE_PNG" --out "$ICONSET_DIR/$name" >/dev/null
done

/usr/bin/iconutil -c icns "$ICONSET_DIR" -o "$RESOURCE_DIR/AppIcon.icns"
echo "$RESOURCE_DIR/AppIcon.icns"
