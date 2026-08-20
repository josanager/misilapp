import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Uso: generate-icon.swift <logo.svg> <salida.png>\n", stderr)
    exit(2)
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let logo = NSImage(contentsOf: sourceURL) else {
    fputs("No se pudo abrir el logotipo.\n", stderr)
    exit(3)
}

let dimension = 1024
let image = NSImage(size: NSSize(width: dimension, height: dimension))
image.lockFocus()

let canvas = NSRect(x: 0, y: 0, width: dimension, height: dimension)
NSColor(calibratedRed: 21 / 255, green: 0, blue: 0, alpha: 1).setFill()
NSBezierPath(roundedRect: canvas.insetBy(dx: 24, dy: 24), xRadius: 215, yRadius: 215).fill()

NSColor(calibratedWhite: 1, alpha: 0.08).setStroke()
let border = NSBezierPath(roundedRect: canvas.insetBy(dx: 25, dy: 25), xRadius: 214, yRadius: 214)
border.lineWidth = 3
border.stroke()

let logoRect = NSRect(x: 177, y: 174, width: 670, height: 672)
logo.draw(in: logoRect, from: .zero, operation: .sourceOver, fraction: 1)
image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:])
else {
    fputs("No se pudo codificar el icono.\n", stderr)
    exit(4)
}

try png.write(to: outputURL, options: .atomic)
