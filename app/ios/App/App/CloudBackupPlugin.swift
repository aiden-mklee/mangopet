import Foundation
import Capacitor

// iCloud key-value backup of the save (1.0.3). The web side keeps the save in localStorage and the
// Preferences copy; this keeps one more copy in the user's iCloud so deleting the app or moving to a
// new iPhone brings the record back. NSUbiquitousKeyValueStore: up to 1 MB per app, no setup for the user.
@objc(CloudBackupPlugin)
public class CloudBackupPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudBackupPlugin"
    public let jsName = "CloudBackup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]
    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(changed(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: store)
        store.synchronize()
    }

    // values that arrive from iCloud after launch (a fresh install downloads them a moment later)
    @objc private func changed(_ note: Notification) {
        let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        notifyListeners("change", data: ["keys": keys])
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key is required"); return }
        store.synchronize()
        if let value = store.string(forKey: key) { call.resolve(["value": value]) } else { call.resolve([:]) }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else { call.reject("key and value are required"); return }
        if value.utf8.count > 900_000 { call.reject("too large"); return }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key is required"); return }
        store.removeObject(forKey: key)
        store.synchronize()
        call.resolve()
    }

    // whether the phone is signed in to iCloud (without it nothing is kept, and settings say so)
    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["signedIn": FileManager.default.ubiquityIdentityToken != nil])
    }
}
