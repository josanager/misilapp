#!/bin/zsh
set -euo pipefail

PACKAGE_DIR="${0:A:h:h}"
ARCH="${MISIL_ARCH:-$(/usr/bin/uname -m)}"
SDK_PATH=$(/usr/bin/xcrun --sdk macosx --show-sdk-path)
TEST_DIR="$PACKAGE_DIR/.build/native-tests-$ARCH"

/bin/mkdir -p "$TEST_DIR"
/usr/bin/xcrun swiftc \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  "$PACKAGE_DIR/Sources/MISILNative/Models.swift" \
  "$PACKAGE_DIR/Tests/StoragePolicyCheck.swift" \
  -o "$TEST_DIR/StoragePolicyCheck"

"$TEST_DIR/StoragePolicyCheck"
