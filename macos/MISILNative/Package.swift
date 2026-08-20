// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MISILNative",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "MISIL", targets: ["MISILNative"]),
    ],
    targets: [
        .executableTarget(
            name: "MISILNative",
            linkerSettings: [
                .linkedFramework("Security"),
            ]
        ),
        .testTarget(
            name: "MISILNativeTests",
            dependencies: ["MISILNative"]
        ),
    ]
)
