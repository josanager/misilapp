import XCTest
@testable import MISILNative

final class StoragePolicyTests: XCTestCase {
    func testPresetByteConversionUsesBinaryGigabytes() {
        XCTAssertEqual(StoragePolicy.bytes(forGiB: 10), 10_737_418_240)
        XCTAssertEqual(StoragePolicy.bytes(forGiB: 500), 536_870_912_000)
    }

    func testCustomQuotaRejectsValuesBelowTenGiB() {
        XCTAssertThrowsError(
            try StoragePolicy.validate(
                gibibytes: 9,
                availableBytes: StoragePolicy.bytes(forGiB: 100)
            )
        ) { error in
            XCTAssertEqual(error as? StorageSetupError, .belowMinimum)
        }
    }

    func testQuotaPreservesFiveGiBSafetyMargin() {
        let available = StoragePolicy.bytes(forGiB: 55)
        XCTAssertEqual(StoragePolicy.maxShareableGiB(availableBytes: available), 50)
        XCTAssertNoThrow(try StoragePolicy.validate(gibibytes: 50, availableBytes: available))
        XCTAssertThrowsError(try StoragePolicy.validate(gibibytes: 51, availableBytes: available))
    }
}
