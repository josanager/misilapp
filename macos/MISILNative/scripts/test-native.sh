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

/usr/bin/xcrun swiftc \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModels.swift" \
  "$PACKAGE_DIR/Tests/AgerbotContractCheck.swift" \
  -o "$TEST_DIR/AgerbotContractCheck"

"$TEST_DIR/AgerbotContractCheck"

if /usr/bin/grep -E 'InternetMessaging(Client)?|HubMessage|MessagingIdentity' \
  "$PACKAGE_DIR/Sources/MISILNative"/Agerbot*.swift >/dev/null; then
  echo "Agerbot no debe depender del canal MISIL Hub" >&2
  exit 1
fi

echo "AgerbotIsolation: conversación local separada del Hub"

/usr/bin/xcrun swiftc \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  -framework CryptoKit \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModels.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModelDiscoveryService.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotSettingsStore.swift" \
  "$PACKAGE_DIR/Tests/AgerbotDiscoveryCheck.swift" \
  -o "$TEST_DIR/AgerbotDiscoveryCheck"

"$TEST_DIR/AgerbotDiscoveryCheck"

/usr/bin/xcrun swiftc \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  -framework CryptoKit \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModels.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModelDiscoveryService.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotReleaseService.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModelDownloadService.swift" \
  "$PACKAGE_DIR/Tests/AgerbotReleaseServiceCheck.swift" \
  -o "$TEST_DIR/AgerbotReleaseServiceCheck"

"$TEST_DIR/AgerbotReleaseServiceCheck"

/usr/bin/xcrun swiftc \
  -parse-as-library \
  -target "$ARCH-apple-macosx14.0" \
  -sdk "$SDK_PATH" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModels.swift" \
  "$PACKAGE_DIR/Sources/MISILNative/AgerbotModelActivation.swift" \
  "$PACKAGE_DIR/Tests/AgerbotActivationCheck.swift" \
  -o "$TEST_DIR/AgerbotActivationCheck"

"$TEST_DIR/AgerbotActivationCheck"
