import Foundation
import React

/**
 * ShieldScan - iOS Native Security Module
 *
 * Performs runtime security checks for @noobdigital/react-native-shieldscan.
 * Compatible with both Old Architecture (Bridge) and New Architecture (JSI).
 *
 * Checks performed:
 *  - Jailbreak detection via file path scanning + write test
 *  - Frida detection via dylib injection, port 27042, env var
 *  - Debugger detection via ptrace / kinfo_proc
 *  - Simulator detection via targetEnvironment compiler directive
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
    ]
    resolve(result)
  }

  // ─── Jailbreak Detection ──────────────────────────────────────────────────

  /**
   * Multi-vector jailbreak detection:
   * 1. Known jailbreak file paths (Cydia, MobileSubstrate, bash, ssh, apt)
   * 2. Write test to /private (sandboxed apps cannot write outside their container)
   * 3. Symbolic link test for /Applications (jailbroken devices remount this)
   */
  private func isJailbroken() -> Bool {

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
    } catch {
      // Expected on a clean device — write is blocked
    }

    // Symbolic link check: jailbroken devices relink /Applications
    if let _ = try? FileManager.default.destinationOfSymbolicLink(atPath: "/Applications") {
      return true
    }

    return false
    #endif
  }

  // ─── File-Based Checks ────────────────────────────────────────────────────

  /**
   * Checks for Frida agent dylib on disk.
   * Covers the default Frida gadget injection path on iOS.
   */
  private func hasSuspiciousFiles() -> Bool {
    let suspiciousPaths = [
      "/usr/lib/frida/frida-agent.dylib",
      "/usr/lib/frida/frida-gadget.dylib",
    ]
    return suspiciousPaths.contains { FileManager.default.fileExists(atPath: $0) }
  }

  // ─── Frida Detection ─────────────────────────────────────────────────────

  /**
   * Multi-vector Frida detection:
   * 1. dlopen for injected Frida dylibs
   * 2. TCP port 27042 (Frida server default)
   * 3. FRIDA_DEBUG environment variable
   */
  private func isFridaDetected() -> Bool {
    // Dylib injection check
    let fridaDylibs = ["frida-agent.dylib", "FridaGadget.dylib"]
    for dylib in fridaDylibs {
      if dlopen(dylib, RTLD_NOW) != nil { return true }
    }

    // Port check
    if isFridaPortOpen(port: 27042) { return true }

    // Environment variable (useful in some server-side Frida setups)
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

  /**
   * Detects if a debugger is attached using the P_TRACED flag via sysctl.
   * Works for both lldb (Xcode) and ADB-based debuggers.
   */
  private func isDebuggerAttached() -> Bool {
    var info = kinfo_proc()
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    var size = MemoryLayout<kinfo_proc>.stride
    let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
    return result == 0 && (info.kp_proc.p_flag & P_TRACED) != 0
  }

  // ─── Simulator Detection ──────────────────────────────────────────────────

  /**
   * Detects iOS Simulator at compile time.
   * This is a zero-cost check — the compiler strips the other branch entirely.
   */
  private func isSimulator() -> Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }
}
