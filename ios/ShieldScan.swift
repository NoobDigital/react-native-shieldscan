import Foundation
import React
import Darwin
import MachO.dyld

/**
 * ShieldScan - iOS Native Security Module
 *
 * Performs runtime security checks for @noobdigital/react-native-shieldscan.
 * Compatible with both Old Architecture (Bridge) and New Architecture (JSI).
 */
@objc(ShieldScan)
class ShieldScan: NSObject {

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

  /**
   * IMPORTANT: Jailbreak checks are disabled on the iOS Simulator.
   *
   * Reason:
   * The simulator environment contains many filesystem paths that also exist
   * on jailbroken devices (e.g., /bin/bash, /usr/sbin/sshd, /etc/apt).
   * These come from macOS, not from a jailbreak.
   */
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
      "/private/preboot",
      "/usr/libexec/substrate",
      "/usr/libexec/substitute"
    ]

    for path in jailbreakPaths {
      if FileManager.default.fileExists(atPath: path) { return true }
    }

    // Write test: jailbroken apps can escape the sandbox
    let testPath = "/private/jailbreak_test_\(UUID().uuidString)"
    do {
      try "shieldscan_test".write(toFile: testPath, atomically: true, encoding: .utf8)
      try? FileManager.default.removeItem(atPath: testPath)
      return true
    } catch {}

    // Symbolic link check
    if let _ = try? FileManager.default.destinationOfSymbolicLink(atPath: "/Applications") {
      return true
    }

    return false
  }

  // ─── Hook Detection ───────────────────────────────────────────────────────

  /**
   * Detects presence of common iOS runtime hooking frameworks.
   *
   * Strategy:
   *  - Scan loaded dynamic libraries via dyld
   *  - Look for known hooking-related substrings
   */
  private func isHookingFrameworkPresent() -> Bool {
      #if targetEnvironment(simulator)
      return false
      #endif

      let hookIndicators = [
          // Cydia Substrate
          "Substrate",
          "MobileSubstrate",
          "SubstrateLoader",

          // Substitute
          "Substitute",

          // LibHooker
          "LibHooker",

          // Tweak injection
          "TweakInject",

          // Frida (dyld-injected)
          "FridaGadget",
          "frida-agent",
          "frida-gadget"
      ]

      let imageCount = _dyld_image_count()
      for i in 0..<imageCount {
          if let cName = _dyld_get_image_name(i) {
              let name = String(cString: cName)
              if hookIndicators.contains(where: { name.localizedCaseInsensitiveContains($0) }) {
                  return true
              }
          }
      }

      // Additional check: Substrate/LibHooker tweak injection folder
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
}
