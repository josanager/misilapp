import Foundation
import Security

enum KeychainService {
    private static let service = "com.misil.desktop.storage"
    private static let account = "master-key-v1"

    static func loadOrCreateMasterKey() throws -> Data {
        if let existing = try loadMasterKey() {
            return existing
        }

        var bytes = [UInt8](repeating: 0, count: 32)
        let randomStatus = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard randomStatus == errSecSuccess else {
            throw StorageSetupError.keychainFailure(randomStatus)
        }
        let key = Data(bytes)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrLabel as String: "Clave maestra de almacenamiento de MISIL",
            kSecAttrDescription as String: "Cifra exclusivamente los archivos aportados al nodo local de MISIL.",
            kSecValueData as String: key,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem, let existing = try loadMasterKey() {
            return existing
        }
        guard status == errSecSuccess else {
            throw StorageSetupError.keychainFailure(status)
        }
        return key
    }

    private static func loadMasterKey() throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw StorageSetupError.keychainFailure(status)
        }
        return result as? Data
    }

}
