#!/bin/zsh
set -euo pipefail

PACKAGE_DIR="${0:A:h:h}"
ARCH="${MISIL_ARCH:-$(/usr/bin/uname -m)}"
OUTPUT_DIR="$PACKAGE_DIR/dist"
STAGE_DIR="$PACKAGE_DIR/.build/dmg-stage-$ARCH"
MOUNT_DIR="$PACKAGE_DIR/.build/dmg-mount-$ARCH"
RW_DMG="$PACKAGE_DIR/.build/MISIL-Local-Alpha-$ARCH-rw.dmg"
DMG_PATH="$OUTPUT_DIR/MISIL-Desktop-Alpha-0.3.0-macOS-$ARCH.dmg"

"$PACKAGE_DIR/scripts/build-app.sh"

/bin/rm -rf "$STAGE_DIR"
/bin/rm -rf "$MOUNT_DIR"
/bin/rm -f "$RW_DMG"
/bin/mkdir -p "$STAGE_DIR" "$MOUNT_DIR"
/usr/bin/ditto "$OUTPUT_DIR/MISIL.app" "$STAGE_DIR/MISIL.app"
/bin/ln -s /Applications "$STAGE_DIR/Applications"
/usr/bin/ditto "$PACKAGE_DIR/Resources/AppIcon.icns" "$STAGE_DIR/.VolumeIcon.icns"

/usr/bin/hdiutil create \
  -volname "MISIL Local Alpha" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDRW \
  "$RW_DMG" >/dev/null

/usr/bin/hdiutil attach \
  -nobrowse \
  -mountpoint "$MOUNT_DIR" \
  "$RW_DMG" >/dev/null

/Library/Developer/CommandLineTools/usr/bin/SetFile -a C "$MOUNT_DIR"
/usr/bin/hdiutil detach "$MOUNT_DIR" >/dev/null

/usr/bin/hdiutil convert "$RW_DMG" \
  -format UDZO \
  -ov \
  -o "$DMG_PATH" >/dev/null

/usr/bin/hdiutil verify "$DMG_PATH"
echo "$DMG_PATH"
