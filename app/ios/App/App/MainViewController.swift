import UIKit
import Capacitor

// The app's own plugins that are not npm packages (Main.storyboard uses this class instead of CAPBridgeViewController)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudBackupPlugin())
    }
}
