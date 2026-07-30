import Foundation
import React
import Darwin
import MachO.dyld
import UIKit 

/**
 * ShieldScan - iOS Native Security Module
 *
 * Performs runtime security checks for @noobdigital/react-native-shieldscan.
 * Compatible with both Old Architecture (Bridge) and New Architecture (JSI).
 */
@objc(ShieldScan)
class ShieldScan: NSObject {

  // ─── NEW: Screen security state ───────────────────────────────────────────
  // Added for blur + screenshot prevention features.
  // Declared here so init() can call setupLifecycleObservers().

  private var isBlurEnabled: Bool = false
  private var isScreenshotPreventionEnabled: Bool = false
  private var blurView: UIView?
  private var secureTextField: UITextField?
  private var secureContainer: UIWindow?
  private static let blurViewTag = 0x5A1E5C4A

  // ─── NEW: Override init to wire lifecycle observers ───────────────────────

  override init() {
    super.init()
    setupLifecycleObservers()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // ─── Main Entry Point ─────────────────────────────────────────────────────

  @objc
  func runSecurityChecks(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let result: [String: Bool] = [
      "rooted":        isJailbroken(),
      "fileBasedRoot": hasSuspiciousFiles(),
      "fridaDetected": isFridaDetected(),
      "debugger":      isDebuggerAttached(),
      "emulator":      isSimulator(),
      "hooksDetected": isHookingFrameworkPresent(),
      "developerMode": isDeveloperModeEnabled()
    ]
    resolve(result)
  }

  // ─── Jailbreak Detection ──────────────────────────────────────────────────

  private func isJailbroken() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #endif

    let jailbreakPaths = [
      "/Applications/Cydia.app",
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/bin/bash",
      "/usr/sbin/sshd",
      "/etc/apt",
      "/private/var/lib/apt",
      "/private/var/mobile/Library/SBSettings/Themes",
      "/Library/MobileSubstrate/DynamicLibraries/LiveClock.plist",
      "/usr/libexec/cydia",
      "/var/cache/apt",
      "/var/lib/apt",
      "/var/lib/cydia",
      "/var/jb",
      "/var/lib/jb",
      "/usr/libexec/substrate",
      "/usr/libexec/substitute"
    ]

    for path in jailbreakPaths {
      if FileManager.default.fileExists(atPath: path) { return true }
    }

    return false
}

  // ─── Hook Detection ───────────────────────────────────────────────────────

  private func isHookingFrameworkPresent() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #endif

    let hookIndicators = [
        // Substrate ecosystem — jailbreak-specific, no legit SDK collision
        "MobileSubstrate",
        "SubstrateLoader",
        "SubstrateBootstrap",
        "SubstrateInserter",
        "CydiaSubstrate",
        "RocketBootstrap",
        "PreferenceLoader",

        // Frida — specific tool/binary names
        "FridaGadget",
        "frida-agent",
        "frida-gadget",

        // Hooking libraries — specific, technical names
        "LibHooker",
        "TweakInject",
        "cynject",
        "cyinject",
        "libcycript",

        // Jailbreak-specific tweaks/tools — distinctive names, no real-world overlap
        "Cephei",
        "ABypass",
        "AppSyncUnified-FrontBoard",
        "FlyJB",
        "0Shadow",
        "SSLKillSwitch",
        "SSLKillSwitch2",
        "WeeLoader",
        "systemhook",       // Dopamine anti-detection bypass
        "libsparkapplist",
        "zzzzLiberty",
        "zzzzzzUnSub",
        "CustomWidgetIcons"
    ]

    let imageCount = _dyld_image_count()
    for i in 0..<imageCount {
        if let cName = _dyld_get_image_name(i) {
             let name = String(cString: cName).lowercased()
              if hookIndicators.contains(where: { name.contains($0) }) {
                  return true
              }
        }
    }

    let tweakPaths = [
        "/Library/MobileSubstrate/DynamicLibraries",
        "/usr/lib/TweakInject"
    ]

    for path in tweakPaths {
        if FileManager.default.fileExists(atPath: path) {
            return true
        }
    }

    return false
  }
  private func isDeveloperModeEnabled() -> Bool {
      return ProcessInfo.processInfo.environment["DEVELOPER_MODE"] != nil
  }

  // ─── File-Based Checks ────────────────────────────────────────────────────

  private func hasSuspiciousFiles() -> Bool {
    let suspiciousPaths = [
      "/usr/lib/frida/frida-agent.dylib",
      "/usr/lib/frida/frida-gadget.dylib",
    ]
    return suspiciousPaths.contains { FileManager.default.fileExists(atPath: $0) }
  }

  // ─── Frida Detection ─────────────────────────────────────────────────────

  private func isFridaDetected() -> Bool {
    let fridaLibs = [
        "frida-agent.dylib",
        "frida-agent-64.dylib",
        "frida-agent-32.dylib",
        "FridaGadget.dylib",
        "libfrida-gadget.dylib"
    ]

    for dylib in fridaLibs {
        if dlopen(dylib, RTLD_NOW) != nil {
            return true
        }
    }

    if isFridaPortOpen(port: 27042) { return true }

    if ProcessInfo.processInfo.environment["FRIDA_DEBUG"] != nil { return true }

    return false
  }

  private func isFridaPortOpen(port: Int32) -> Bool {
    let sock = Darwin.socket(AF_INET, SOCK_STREAM, 0)
    guard sock != -1 else { return false }
    defer { Darwin.close(sock) }

    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = UInt16(port).bigEndian
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")

    return withUnsafePointer(to: &addr) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.connect(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
      }
    }
  }

  // ─── Debugger Detection ──────────────────────────────────────────────────

  private func isDebuggerAttached() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #endif
    var info = kinfo_proc()
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    var size = MemoryLayout<kinfo_proc>.stride
    let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
    return result == 0 && (info.kp_proc.p_flag & P_TRACED) != 0
  }

  // ─── Simulator Detection ──────────────────────────────────────────────────

  private func isSimulator() -> Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }
// ─── Background Blur ──────────────────────────────────────────────────────

@objc
func setBlurEnabled(
  _ enabled: Bool,
  resolver resolve: RCTPromiseResolveBlock,
  rejecter reject: RCTPromiseRejectBlock
) {
  isBlurEnabled = enabled
  if !enabled {
    removeBlurOverlay()
  }
  resolve(["blurEnabled": enabled])
}

// ─── Screenshot & Recording Prevention ───────────────────────────────────

@objc
func setScreenshotPreventionEnabled(
  _ enabled: Bool,
  resolver resolve: @escaping RCTPromiseResolveBlock,
  rejecter reject: @escaping RCTPromiseRejectBlock
) {
  DispatchQueue.main.async { [weak self] in
    guard let self = self else { return }
    self.isScreenshotPreventionEnabled = enabled
    if enabled {
      self.enableScreenshotPrevention()
    } else {
      self.disableScreenshotPrevention()
    }
    resolve(["screenshotPreventionEnabled": enabled])
  }
}

@objc
func isScreenBeingRecorded(
  _ resolve: @escaping RCTPromiseResolveBlock,
  rejecter reject: @escaping RCTPromiseRejectBlock
) {
  DispatchQueue.main.async {
    resolve(["isRecording": UIScreen.main.isCaptured])
  }
}

// ─── Screenshot prevention implementation ────────────────────────────────

private func enableScreenshotPrevention() {
  guard secureContainer == nil else { return }
  guard let appWindow = getAppWindow() else { return }

  let field = UITextField()
  field.isSecureTextEntry = true
  field.translatesAutoresizingMaskIntoConstraints = false

  let window: UIWindow
  if #available(iOS 13.0, *) {
    guard let scene = appWindow.windowScene else { return }
    window = UIWindow(windowScene: scene)
  } else {
    window = UIWindow(frame: appWindow.bounds)
  }

  window.frame = appWindow.bounds
  window.windowLevel = .alert + 1
  window.backgroundColor = .clear
  window.isUserInteractionEnabled = false

  let vc = UIViewController()
  vc.view.backgroundColor = .clear
  vc.view.addSubview(field)

  NSLayoutConstraint.activate([
    field.topAnchor.constraint(equalTo: vc.view.topAnchor),
    field.bottomAnchor.constraint(equalTo: vc.view.bottomAnchor),
    field.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
    field.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor),
  ])

  window.rootViewController = vc
  window.isHidden = false
  window.layoutIfNeeded()

  secureTextField = field
  secureContainer = window
}

private func disableScreenshotPrevention() {
  secureContainer?.isHidden = true
  secureContainer?.rootViewController = nil
  secureContainer = nil
  secureTextField = nil
}

// ─── Blur implementation (UPDATED) ────────────────────────────────────────

@objc private func appWillResignActive() {
  guard isBlurEnabled else { return }
  addBlurOverlay()
}

@objc private func appDidBecomeActive() {
  removeBlurOverlay()
}

private func addBlurOverlay() {
    DispatchQueue.main.async { [weak self] in
        guard let self = self, let window = self.getAppWindow() else { return }

        // Remove existing overlay
        window.viewWithTag(ShieldScan.blurViewTag)?.removeFromSuperview()

        // Fullscreen overlay
        let overlay = UIView(frame: window.bounds)
        overlay.backgroundColor = UIColor.systemBackground
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.tag = ShieldScan.blurViewTag

        // Label
        let label = UILabel()
        label.text = "We’re protecting your sensitive content."
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        label.textColor = UIColor.label
        label.translatesAutoresizingMaskIntoConstraints = false

        overlay.addSubview(label)

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: overlay.centerYAnchor)
        ])

        window.addSubview(overlay)
        self.blurView = overlay
    }
}

private func removeBlurOverlay() {
  DispatchQueue.main.async { [weak self] in
    guard let self = self, let window = self.getAppWindow() else { return }
    window.viewWithTag(ShieldScan.blurViewTag)?.removeFromSuperview()
    self.blurView = nil
  }
}

// ─── Window helper (UPDATED) ──────────────────────────────────────────────

private func getAppWindow() -> UIWindow? {
  if #available(iOS 13.0, *) {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }

    // Exclude secure container + hidden windows
    let filtered = windows.filter { window in
      window !== secureContainer &&
      !window.isHidden &&
      window.alpha > 0.01
    }

    // Prefer normal-level windows, fallback to any visible window
    return filtered.first(where: { $0.windowLevel == .normal })
        ?? filtered.first
  } else {
    return UIApplication.shared.keyWindow
  }
}

// ─── Lifecycle observers (UPDATED) ─────────────────────────────────────────

private func setupLifecycleObservers() {
  NotificationCenter.default.addObserver(
    self,
    selector: #selector(appWillResignActive),
    name: UIApplication.willResignActiveNotification,
    object: nil
  )

  NotificationCenter.default.addObserver(
    self,
    selector: #selector(appDidBecomeActive),
    name: UIApplication.didBecomeActiveNotification,
    object: nil
  )
}
}
