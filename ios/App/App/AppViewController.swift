import Capacitor

class AppViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        if let scrollView = webView?.scrollView {
            scrollView.isScrollEnabled = false
            scrollView.bounces = false
            scrollView.alwaysBounceVertical = false
            scrollView.alwaysBounceHorizontal = false
            scrollView.showsVerticalScrollIndicator = false
            scrollView.showsHorizontalScrollIndicator = false
            scrollView.contentInsetAdjustmentBehavior = .never
        }
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AlarmReminderPlugin())
    }
}
