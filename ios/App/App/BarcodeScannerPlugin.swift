import AVFoundation
import Capacitor
import UIKit

@objc(BarcodeScannerPlugin)
class BarcodeScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "BarcodeScannerPlugin"
    let jsName = "BarcodeScanner"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func scan(_ call: CAPPluginCall) {
        if pendingCall != nil {
            call.reject("A barcode scanner is already open")
            return
        }
        pendingCall = call
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presentScanner()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        self.presentScanner()
                    } else {
                        self.rejectPending("Camera permission denied")
                    }
                }
            }
        default:
            rejectPending("Camera permission denied")
        }
    }

    private func presentScanner() {
        guard let call = pendingCall else { return }
        guard let presenter = topViewController(from: bridge?.viewController) else {
            rejectPending("Unable to present barcode scanner")
            return
        }
        guard presenter.presentedViewController == nil else {
            rejectPending("Another view is already open")
            return
        }

        let controller = BarcodeScannerViewController()
        controller.onResult = { [weak self] barcode, format in
            guard let self, let pending = self.pendingCall else { return }
            self.pendingCall = nil
            presenter.dismiss(animated: true)
            pending.resolve([
                "barcode": barcode,
                "format": format,
                "cancelled": false
            ])
        }
        controller.onCancel = { [weak self] in
            guard let self, let pending = self.pendingCall else { return }
            self.pendingCall = nil
            presenter.dismiss(animated: true)
            pending.resolve(["cancelled": true])
        }
        controller.modalPresentationStyle = .fullScreen
        presenter.present(controller, animated: true)
        _ = call
    }

    private func rejectPending(_ message: String) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        call.reject(message)
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
}

private class BarcodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((String, String) -> Void)?
    var onCancel: (() -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var completed = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCamera()
        configureOverlay()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.startRunning()
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning {
            session.stopRunning()
        }
    }

    private func configureCamera() {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera),
              session.canAddInput(input) else {
            finishCancel()
            return
        }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            finishCancel()
            return
        }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        output.metadataObjectTypes = supportedTypes(output.availableMetadataObjectTypes)

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = view.bounds
        view.layer.insertSublayer(preview, at: 0)
        previewLayer = preview
    }

    private func supportedTypes(_ available: [AVMetadataObject.ObjectType]) -> [AVMetadataObject.ObjectType] {
        let requested: [AVMetadataObject.ObjectType] = [
            .ean13,
            .ean8,
            .upce,
            .code128,
            .code39,
            .interleaved2of5,
            .qr
        ]
        return requested.filter { available.contains($0) }
    }

    private func configureOverlay() {
        let hint = UILabel()
        hint.translatesAutoresizingMaskIntoConstraints = false
        hint.text = "对准商品条形码"
        hint.textAlignment = .center
        hint.textColor = .white
        hint.font = .systemFont(ofSize: 17, weight: .semibold)
        hint.backgroundColor = UIColor.black.withAlphaComponent(0.42)
        hint.layer.cornerRadius = 8
        hint.layer.masksToBounds = true
        view.addSubview(hint)

        let cancel = UIButton(type: .system)
        cancel.translatesAutoresizingMaskIntoConstraints = false
        cancel.setTitle("取消", for: .normal)
        cancel.setTitleColor(.white, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        cancel.backgroundColor = UIColor.black.withAlphaComponent(0.32)
        cancel.layer.cornerRadius = 8
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(cancel)

        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            cancel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            cancel.widthAnchor.constraint(equalToConstant: 88),
            cancel.heightAnchor.constraint(equalToConstant: 46),
            hint.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 18),
            hint.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -18),
            hint.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -72),
            hint.heightAnchor.constraint(equalToConstant: 58)
        ])
    }

    @objc private func cancelTapped() {
        finishCancel()
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !completed else { return }
        for metadata in metadataObjects {
            guard let readable = metadata as? AVMetadataMachineReadableCodeObject,
                  let value = readable.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else {
                continue
            }
            completed = true
            onResult?(value, readable.type.rawValue)
            break
        }
    }

    private func finishCancel() {
        guard !completed else { return }
        completed = true
        onCancel?()
    }
}
