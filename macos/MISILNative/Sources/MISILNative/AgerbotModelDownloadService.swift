import CryptoKit
import Foundation

@MainActor
final class AgerbotModelDownloadService: NSObject, ObservableObject, @unchecked Sendable {
    @Published private(set) var progress = 0.0
    @Published private(set) var isDownloading = false

    private var activeTask: URLSessionDownloadTask?
    private var continuation: CheckedContinuation<URL, Error>?
    private var completedLocation: URL?
    private var downloadsRoot: URL?
    private var resumeDataURL: URL?
    private lazy var session = URLSession(
        configuration: .default,
        delegate: self,
        delegateQueue: nil
    )

    func download(asset: AgerbotGitHubAsset, to downloadsRoot: URL) async throws -> URL {
        guard !isDownloading else { throw AgerbotReleaseError.downloadFailed }
        try FileManager.default.createDirectory(
            at: downloadsRoot,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        self.downloadsRoot = downloadsRoot
        resumeDataURL = downloadsRoot.appendingPathComponent("resume-data.bin")
        progress = 0
        isDownloading = true
        completedLocation = nil
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                let task: URLSessionDownloadTask
                if let resumeDataURL,
                   let resumeData = try? Data(contentsOf: resumeDataURL),
                   !resumeData.isEmpty {
                    task = session.downloadTask(withResumeData: resumeData)
                } else {
                    var request = URLRequest(url: asset.browserDownloadURL)
                    request.timeoutInterval = 600
                    request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")
                    task = session.downloadTask(with: request)
                }
                activeTask = task
                task.resume()
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.cancel() }
        }
    }

    func cancel() {
        guard let activeTask, let resumeDataURL else { return }
        activeTask.cancel { resumeData in
            guard let resumeData else { return }
            try? resumeData.write(to: resumeDataURL, options: .atomic)
        }
    }

    private func finish(_ result: Result<URL, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        activeTask = nil
        isDownloading = false
        continuation.resume(with: result)
    }
}

extension AgerbotModelDownloadService: URLSessionDownloadDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        let value = totalBytesExpectedToWrite > 0
            ? Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
            : 0
        Task { @MainActor [weak self] in self?.progress = value }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        Task { @MainActor [weak self] in
            guard let self, let downloadsRoot = self.downloadsRoot else { return }
            let destination = downloadsRoot.appendingPathComponent("candidate-\(UUID().uuidString).download")
            do {
                try FileManager.default.moveItem(at: location, to: destination)
                self.completedLocation = destination
            } catch {
                self.finish(.failure(AgerbotReleaseError.downloadFailed))
            }
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let error {
                let resumeData = (error as NSError).userInfo[NSURLSessionDownloadTaskResumeData] as? Data
                if let resumeData, let resumeDataURL = self.resumeDataURL {
                    try? resumeData.write(to: resumeDataURL, options: .atomic)
                }
                self.finish(.failure(error))
            } else if let location = self.completedLocation {
                if let resumeDataURL = self.resumeDataURL { try? FileManager.default.removeItem(at: resumeDataURL) }
                self.progress = 1
                self.finish(.success(location))
            } else {
                self.finish(.failure(AgerbotReleaseError.downloadFailed))
            }
        }
    }
}

actor AgerbotArtifactStager {
    func verifyAndStage(
        downloadedFile: URL,
        candidate: AgerbotRemoteModelCandidate,
        stagingRoot: URL
    ) throws -> URL {
        let attributes = try FileManager.default.attributesOfItem(atPath: downloadedFile.path)
        guard let size = attributes[.size] as? NSNumber,
              size.uint64Value == candidate.manifest.artifact.sizeBytes else {
            throw AgerbotReleaseError.artifactSizeMismatch
        }
        let data = try Data(contentsOf: downloadedFile, options: .mappedIfSafe)
        let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard hash == candidate.manifest.artifact.sha256.lowercased() else {
            throw AgerbotReleaseError.artifactHashMismatch
        }
        try FileManager.default.createDirectory(
            at: stagingRoot,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let staged = stagingRoot.appendingPathComponent("\(candidate.manifest.release.version)-\(UUID().uuidString).pt")
        try FileManager.default.copyItem(at: downloadedFile, to: staged)
        return staged
    }
}
