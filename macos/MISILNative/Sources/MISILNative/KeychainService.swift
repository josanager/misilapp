import Foundation
import Security

enum KeychainService {
    private static let service = "com.misil.desktop.storage"
    private static let account = "master-key-v1"
    private static let relayAccount = "relay-identity-v1"

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

    static func loadRelayIdentity() throws -> NativeRelayIdentity? {
        guard let data = try load(account: relayAccount) else { return nil }
        return try JSONDecoder().decode(NativeRelayIdentity.self, from: data)
    }

    static func saveRelayIdentity(_ identity: NativeRelayIdentity) throws {
        let data = try JSONEncoder().encode(identity)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: relayAccount,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrLabel as String: "Identidad cifrada de MISIL Web",
            kSecAttrDescription as String: "Permite sincronizar mensajes temporales entre MISIL y la web.",
        ]
        let update = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if update == errSecItemNotFound {
            var insertion = query
            attributes.forEach { insertion[$0.key] = $0.value }
            let status = SecItemAdd(insertion as CFDictionary, nil)
            guard status == errSecSuccess else { throw StorageSetupError.keychainFailure(status) }
            return
        }
        guard update == errSecSuccess else { throw StorageSetupError.keychainFailure(update) }
    }

    static func deleteRelayIdentity() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: relayAccount,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw StorageSetupError.keychainFailure(status)
        }
    }

    private static func load(account: String) throws -> Data? {
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
        guard status == errSecSuccess else { throw StorageSetupError.keychainFailure(status) }
        return result as? Data
    }
}
