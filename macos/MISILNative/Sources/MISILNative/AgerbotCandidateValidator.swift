import Foundation

@MainActor
final class AgerbotCandidateValidator {
    func validate(
        checkpointURL: URL,
        expectedVersion: String,
        projectPath: String
    ) async -> Bool {
        guard let launch = resolveLaunch(projectPath: projectPath) else { return false }
        let port = Int.random(in: 44_000 ... 46_000)
        let process = Process()
        process.executableURL = launch.executable
        process.arguments = launch.arguments
        process.currentDirectoryURL = URL(fileURLWithPath: projectPath, isDirectory: true)
        var environment = ProcessInfo.processInfo.environment
        environment["AGERBOT_CHECKPOINT"] = checkpointURL.path
        environment["AGERBOT_HOST"] = "127.0.0.1"
        environment["AGERBOT_PORT"] = String(port)
        environment["AGERBOT_DEVICE"] = "auto"
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
        } catch {
            return false
        }
        let client = AgerbotRuntimeClient(baseURL: URL(string: "http://127.0.0.1:\(port)")!)
        var valid = false
        for _ in 0 ..< 120 {
            if !process.isRunning { break }
            if let health = try? await client.health(),
               health.model.loaded == true,
               health.model.version == expectedVersion {
                let diagnostic = try? await client.chat(AgerbotChatRequest(
                    conversationId: "agerbot-validation",
                    message: "Hola",
                    history: [],
                    generation: AgerbotGenerationSettings(maxNewTokens: 4, temperature: 1, topK: 1)
                ))
                valid = diagnostic?.message.content.isEmpty == false
                break
            }
            try? await Task.sleep(for: .milliseconds(250))
        }
        process.terminate()
        for _ in 0 ..< 20 where process.isRunning {
            try? await Task.sleep(for: .milliseconds(100))
        }
        return valid
    }

    private func resolveLaunch(projectPath: String) -> (executable: URL, arguments: [String])? {
        let project = URL(fileURLWithPath: projectPath, isDirectory: true)
        let virtualPython = project.appendingPathComponent(".venv/bin/python")
        if FileManager.default.isExecutableFile(atPath: virtualPython.path) {
            return (virtualPython, ["-m", "agerbot.server"])
        }
        for uvPath in ["/opt/homebrew/bin/uv", "/usr/local/bin/uv"]
            where FileManager.default.isExecutableFile(atPath: uvPath) {
            return (URL(fileURLWithPath: uvPath), ["run", "agerbot-serve"])
        }
        return nil
    }
}
