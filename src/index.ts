import { NativeModules, Platform } from 'react-native';
import NativeShieldScan from './NativeShieldScan';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityScanResult {
  /**
   * True if RootBeer (Android) or jailbreak file paths (iOS) detect a
   * compromised device. This is the primary root/jailbreak signal.
   */
  rooted: boolean;

  /**
   * True if known root/jailbreak/Frida file paths exist on disk.
   * Examples: /sbin/su, /magisk, /system/framework/XposedBridge.jar (Android)
   *           /Applications/Cydia.app, /bin/bash (iOS)
   */
  fileBasedRoot: boolean;

  /**
   * True if Frida instrumentation framework is detected.
   * Checks: frida-server file paths + TCP port 27042 + env vars + dylib injection.
   */
  fridaDetected: boolean;

  /**
   * True if a debugger (lldb, gdb, ADB) is currently attached to the process.
   * Uses ptrace / kinfo_proc on iOS, Debug.isDebuggerConnected on Android.
   */
  debugger: boolean;

  /**
   * True if running on an Android emulator or iOS Simulator.
   * Uses Build.FINGERPRINT heuristics on Android, targetEnvironment on iOS.
   */
  emulator: boolean;
}

// ─── Error Helpers ─────────────────────────────────────────────────────────────

const LINKING_ERROR =
  `The package '@noobdigital/react-native-shieldscan' doesn't seem to be linked. ` +
  `Make sure: \n\n` +
  Platform.select({
    ios: `- You have run 'pod install' in the ios/ directory and rebuilt.\n`,
    android: `- You have rebuilt the Android project.\n`,
    default: '',
  }) +
  `- You are not using Expo Go (bare workflow only).\n` +
  `- The package name in your app matches 'ShieldScan'.`;

// ─── Module Resolution (Old Arch fallback) ────────────────────────────────────

/**
 * Resolves the native module for both Old and New Architecture.
 *
 * New Architecture:  TurboModuleRegistry.getEnforcing via NativeShieldScan.ts
 * Old Architecture:  NativeModules.ShieldScan (bridge)
 *
 * The Proxy ensures a clear error message if the module is not linked,
 * instead of a cryptic "null is not an object" crash.
 */
const ShieldScan = NativeShieldScan ??
  (NativeModules.ShieldScan
    ? NativeModules.ShieldScan
    : new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === '__esModule' || prop === 'default') {
              return undefined;
            }
            throw new Error(LINKING_ERROR);
          },
        }
      ));

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all native security checks in a single call and returns the result.
 *
 * @example
 * ```ts
 * import { runSecurityChecks } from '@noobdigital/react-native-shieldscan';
 *
 * const result = await runSecurityChecks();
 *
 * if (result.rooted || result.fridaDetected) {
 *   // Block access, log to your security backend, or exit
 *   console.warn('Device security check failed', result);
 * }
 * ```
 *
 * @returns A Promise resolving to a {@link SecurityScanResult} object.
 */
export function runSecurityChecks(): Promise<SecurityScanResult> {
  return ShieldScan.runSecurityChecks();
}

/**
 * Convenience: returns true if any security check fails.
 * Useful for a simple gate check on app startup.
 *
 * @example
 * ```ts
 * if (await isDeviceCompromised()) {
 *   Alert.alert('Security Error', 'This device cannot run this app.');
 * }
 * ```
 */
export async function isDeviceCompromised(): Promise<boolean> {
  const result = await runSecurityChecks();
  return result.rooted
    || result.fileBasedRoot
    || result.fridaDetected
    || result.debugger;
  // Note: emulator is intentionally excluded from this convenience check
  // as many teams allow emulator usage in dev/QA environments.
}
