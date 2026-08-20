import Foundation

@main
enum StoragePolicyCheck {
    static func main() throws {
        precondition(StoragePolicy.bytes(forGiB: 10) == 10_737_418_240)
        precondition(StoragePolicy.bytes(forGiB: 500) == 536_870_912_000)

        do {
            try StoragePolicy.validate(
                gibibytes: 9,
                availableBytes: StoragePolicy.bytes(forGiB: 100)
            )
            fatalError("Una cuota inferior a 10 GB fue aceptada")
        } catch StorageSetupError.belowMinimum {
            // Resultado esperado.
        }

        let available = StoragePolicy.bytes(forGiB: 55)
        precondition(StoragePolicy.maxShareableGiB(availableBytes: available) == 50)
        try StoragePolicy.validate(gibibytes: 50, availableBytes: available)

        do {
            try StoragePolicy.validate(gibibytes: 51, availableBytes: available)
            fatalError("La reserva de seguridad no fue aplicada")
        } catch StorageSetupError.insufficientDiskSpace {
            // Resultado esperado.
        }

        print("StoragePolicy: 4 comprobaciones superadas")
    }
}
