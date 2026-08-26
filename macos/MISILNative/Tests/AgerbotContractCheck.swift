import Foundation

@main
struct AgerbotContractCheck {
    static func main() throws {
        let decoder = JSONDecoder()
        let health = try decoder.decode(
            AgerbotHealthResponse.self,
            from: Data(#"{"status":"ready","model":{"name":"Agerbot","version":"test","loaded":true,"parameters":3257856,"device":"cpu"}}"#.utf8)
        )
        precondition(health.model.name == "Agerbot")
        precondition(health.model.parameters == 3_257_856)
        precondition(agerbotReservedConversationID == "agerbot-local")

        let request = AgerbotChatRequest(
            conversationId: agerbotReservedConversationID,
            message: "hola",
            history: [AgerbotHistoryItem(role: "user", content: "antes")],
            generation: AgerbotGenerationSettings(maxNewTokens: 8, temperature: 0.7, topK: 20)
        )
        let encoded = try JSONEncoder().encode(request)
        let object = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        precondition(object?["conversationId"] as? String == "agerbot-local")
        precondition(object?["message"] as? String == "hola")

        let envelope = try decoder.decode(
            AgerbotAPIErrorEnvelope.self,
            from: Data(#"{"error":{"code":"checkpoint_missing","message":"Falta","retryable":false}}"#.utf8)
        )
        precondition(envelope.error.code == "checkpoint_missing")
        print("AgerbotContract: 7 comprobaciones superadas")
    }
}
