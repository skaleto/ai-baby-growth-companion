import AVFoundation
import Capacitor
import Foundation
import ImageIO
import PhotosUI
import UIKit
import UniformTypeIdentifiers

@objc(NativeMediaPickerPlugin)
class NativeMediaPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    let identifier = "NativeMediaPickerPlugin"
    let jsName = "NativeMediaPicker"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickMedia", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private let cacheFolderName = "NativeMediaPicker"
    private let normalizedImageMaxPixelSize = 3000

    @objc func pickMedia(_ call: CAPPluginCall) {
        if pendingCall != nil {
            call.reject("A media picker is already open")
            return
        }

        let limit = max(1, min(call.getInt("limit") ?? 1, 50))
        pendingCall = call

        DispatchQueue.main.async {
            var configuration = PHPickerConfiguration()
            configuration.selectionLimit = limit
            configuration.filter = .any(of: [.images, .videos])
            configuration.preferredAssetRepresentationMode = .current
            if #available(iOS 15.0, *) {
                configuration.selection = .ordered
            }

            guard let presenter = self.topViewController(from: self.bridge?.viewController) else {
                self.pendingCall = nil
                call.reject("Unable to present media picker")
                return
            }
            guard presenter.presentedViewController == nil else {
                self.pendingCall = nil
                call.reject("Another view is already open")
                return
            }

            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    private func topViewController(from root: UIViewController?) -> UIViewController? {
        var top = root
        while let presented = top?.presentedViewController {
            top = presented
        }
        if let navigation = top as? UINavigationController {
            return topViewController(from: navigation.visibleViewController)
        }
        if let tab = top as? UITabBarController {
            return topViewController(from: tab.selectedViewController)
        }
        return top
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pendingCall else { return }
        pendingCall = nil

        if results.isEmpty {
            call.resolve(["items": []])
            return
        }

        var items = [[String: Any]]()
        var firstError: String?

        func exportNext(_ index: Int) {
            if index >= results.count {
                let pickedItems = items.filter { !$0.isEmpty }
                if pickedItems.isEmpty, let firstError {
                    call.reject(firstError)
                    return
                }
                call.resolve(["items": pickedItems])
                return
            }

            exportPickedResult(results[index]) { item, error in
                DispatchQueue.main.async {
                    autoreleasepool {
                        if let item {
                            items.append(item)
                        } else if firstError == nil {
                            firstError = error ?? "Failed to read selected media"
                        }
                    }
                    exportNext(index + 1)
                }
            }
        }

        exportNext(0)
    }

    private func exportPickedResult(_ result: PHPickerResult, completion: @escaping ([String: Any]?, String?) -> Void) {
        let provider = result.itemProvider
        let kindAndType = preferredTypeIdentifier(provider)
        guard let kindAndType else {
            completion(nil, "Unsupported media type")
            return
        }

        provider.loadFileRepresentation(forTypeIdentifier: kindAndType.typeIdentifier) { sourceUrl, error in
            autoreleasepool {
                if let error {
                    completion(nil, error.localizedDescription)
                    return
                }
                guard let sourceUrl else {
                    completion(nil, "Selected media is not available")
                    return
                }

                do {
                    let copiedUrl = try self.copyToCache(sourceUrl, kind: kindAndType.kind, typeIdentifier: kindAndType.typeIdentifier)
                    var item: [String: Any] = [
                        "uri": copiedUrl.absoluteString,
                        "webPath": self.bridge?.portablePath(fromLocalURL: copiedUrl)?.absoluteString ?? copiedUrl.absoluteString,
                        "name": self.displayName(for: provider, copiedUrl: copiedUrl, typeIdentifier: kindAndType.typeIdentifier),
                        "mimeType": self.mimeType(for: kindAndType.typeIdentifier, fallbackExtension: copiedUrl.pathExtension),
                        "kind": kindAndType.kind,
                        "size": self.fileSize(copiedUrl)
                    ]
                    if kindAndType.kind == "video" {
                        let metadata = self.videoMetadata(copiedUrl)
                        if let width = metadata.width { item["width"] = width }
                        if let height = metadata.height { item["height"] = height }
                        if let durationMs = metadata.durationMs { item["durationMs"] = durationMs }
                    }
                    completion(item, nil)
                } catch {
                    completion(nil, error.localizedDescription)
                }
            }
        }
    }

    private func preferredTypeIdentifier(_ provider: NSItemProvider) -> (kind: String, typeIdentifier: String)? {
        let identifiers = provider.registeredTypeIdentifiers
        if let videoIdentifier = identifiers.first(where: { identifier in
            guard let type = UTType(identifier) else { return false }
            return type.conforms(to: .movie) || type.conforms(to: .video) || type.conforms(to: .audiovisualContent)
        }) {
            return ("video", videoIdentifier)
        }
        if let imageIdentifier = identifiers.first(where: { identifier in
            UTType(identifier)?.conforms(to: .image) == true
        }) {
            return ("image", imageIdentifier)
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
            return ("video", UTType.movie.identifier)
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.video.identifier) {
            return ("video", UTType.video.identifier)
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            return ("image", UTType.image.identifier)
        }
        return nil
    }

    private func copyToCache(_ sourceUrl: URL, kind: String, typeIdentifier: String) throws -> URL {
        let fileManager = FileManager.default
        let cacheRoot = try fileManager.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent(cacheFolderName, isDirectory: true)
        try fileManager.createDirectory(at: cacheRoot, withIntermediateDirectories: true)

        if kind == "image" && shouldNormalizeImage(sourceUrl, typeIdentifier: typeIdentifier) {
            let destination = cacheRoot
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("jpg")
            try writeNormalizedJpeg(from: sourceUrl, to: destination)
            return destination
        }

        let extensionFromSource = sourceUrl.pathExtension
        let extensionFromType = UTType(typeIdentifier)?.preferredFilenameExtension ?? ""
        let ext = extensionFromSource.isEmpty ? extensionFromType : extensionFromSource
        let destination = cacheRoot
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext.isEmpty ? "media" : ext)

        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.copyItem(at: sourceUrl, to: destination)
        return destination
    }

    private func shouldNormalizeImage(_ sourceUrl: URL, typeIdentifier: String) -> Bool {
        let mimeType = mimeType(for: typeIdentifier, fallbackExtension: sourceUrl.pathExtension)
        return !["image/jpeg", "image/png", "image/webp", "image/gif"].contains(mimeType)
    }

    private func writeNormalizedJpeg(from sourceUrl: URL, to destination: URL) throws {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithURL(sourceUrl as CFURL, sourceOptions) else {
            throw pluginError("Unable to read selected image")
        }

        let thumbnailOptions = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: false,
            kCGImageSourceThumbnailMaxPixelSize: normalizedImageMaxPixelSize
        ] as CFDictionary
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else {
            throw pluginError("Unable to decode selected image")
        }
        guard let writer = CGImageDestinationCreateWithURL(destination as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw pluginError("Unable to prepare selected image")
        }

        let properties = [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary
        CGImageDestinationAddImage(writer, image, properties)
        if !CGImageDestinationFinalize(writer) {
            throw pluginError("Unable to normalize selected image")
        }
    }

    private func pluginError(_ message: String) -> NSError {
        NSError(domain: "NativeMediaPicker", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func displayName(for provider: NSItemProvider, copiedUrl: URL, typeIdentifier: String) -> String {
        let fallbackBase = provider.suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = (fallbackBase?.isEmpty == false ? fallbackBase : nil) ?? "media"
        let copiedExtension = copiedUrl.pathExtension
        let baseExtension = (base as NSString).pathExtension
        if baseExtension.isEmpty {
            let ext = copiedUrl.pathExtension.isEmpty
                ? (UTType(typeIdentifier)?.preferredFilenameExtension ?? "")
                : copiedUrl.pathExtension
            return ext.isEmpty ? base : "\(base).\(ext)"
        }
        if copiedExtension == "jpg" && !["jpg", "jpeg"].contains(baseExtension.lowercased()) {
            return "\((base as NSString).deletingPathExtension).jpg"
        }
        return base
    }

    private func mimeType(for typeIdentifier: String, fallbackExtension: String) -> String {
        if let fromExtension = UTType(filenameExtension: fallbackExtension)?.preferredMIMEType {
            return fromExtension
        }
        if let preferred = UTType(typeIdentifier)?.preferredMIMEType {
            return preferred
        }
        return typeIdentifier == UTType.movie.identifier ? "video/quicktime" : "application/octet-stream"
    }

    private func fileSize(_ url: URL) -> Int64 {
        let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
        return attributes?[.size] as? Int64 ?? 0
    }

    private func videoMetadata(_ url: URL) -> (width: Int?, height: Int?, durationMs: Int?) {
        let asset = AVURLAsset(url: url)
        let durationSeconds = CMTimeGetSeconds(asset.duration)
        let durationMs = durationSeconds.isFinite ? Int(durationSeconds * 1000) : nil
        guard let track = asset.tracks(withMediaType: .video).first else {
            return (nil, nil, durationMs)
        }
        let size = track.naturalSize.applying(track.preferredTransform)
        return (Int(abs(size.width)), Int(abs(size.height)), durationMs)
    }
}
