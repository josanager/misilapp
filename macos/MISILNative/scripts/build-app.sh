#!/bin/zsh
set -euo pipefail

PACKAGE_DIR="${0:A:h:h}"
ARCH="${MISIL_ARCH:-$(/usr/bin/uname -m)}"
OUTPUT_DIR="$PACKAGE_DIR/dist"
APP_DIR="$OUTPUT_DIR/MISIL.app"
CONTENTS_DIR="$APP_DIR/Contents"

case "$OUTPUT_DIR" in
  "$PACKAGE_DIR"/dist) ;;
  *) echo "Directorio de salida no seguro" >&2; exit 2 ;;
esac

"$PACKAGE_DIR/scripts/generate-icon.sh" >/dev/null
SDK_PATH=$(/usr/bin/xcrun --sdk macosx --show-sdk-path)
BIN_DIR="$PACKAGE_DIR/.build/native-$ARCH"
/bin/mkdir -p "$BIN_DIR"

/usr/bin/xcrun swiftc \
  -O \
  -whole-module-optimization \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  -framework SwiftUI \
  -framework AppKit \
  -framework Security \
  "$PACKAGE_DIR"/Sources/MISILNative/*.swift \
  -o "$BIN_DIR/MISIL"

/usr/bin/strip -x "$BIN_DIR/MISIL"

/bin/rm -rf "$APP_DIR"
/bin/mkdir -p "$CONTENTS_DIR/MacOS" "$CONTENTS_DIR/Resources"
/usr/bin/ditto "$BIN_DIR/MISIL" "$CONTENTS_DIR/MacOS/MISIL"
/usr/bin/ditto "$PACKAGE_DIR/Resources/Info.plist" "$CONTENTS_DIR/Info.plist"
/usr/bin/ditto "$PACKAGE_DIR/Resources/AppIcon.icns" "$CONTENTS_DIR/Resources/AppIcon.icns"
/usr/bin/ditto "$PACKAGE_DIR/../../desktop-assets/MISILLogo.svg" "$CONTENTS_DIR/Resources/MISILLogo.svg"
/bin/chmod 755 "$CONTENTS_DIR/MacOS/MISIL"

/usr/bin/codesign --force --deep --sign - --timestamp=none "$APP_DIR"
/usr/bin/codesign --verify --deep --strict --verbose=1 "$APP_DIR"

echo "$APP_DIR"
