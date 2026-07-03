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

    /**
   * True if a runtime hooking framework is detected.
   *
   * Android:
   *   - Xposed / EdXposed / LSPosed
   *   - Frida gadget / Frida server
   *   - SandHook / Epic
   *   - Hook-related libraries found in /proc/self/maps
   *
   * iOS:
   *   - MobileSubstrate / Cydia Substrate
   *   - Substitute / SubstrateLoader
   *   - LibHooker / TweakInject
   *   - Any injected dylib detected via dyld image scanning
   *
   * Indicates that the app’s runtime may be modified or instrumented.
   */
  hooksDetected: boolean;
  /** True if developer options/mode is enabled on the device.
   *  Android: Settings → Developer Options enabled.
   *  iOS: Not applicable — always false on iOS (no system API exposes this). */
  developerMode: boolean;
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

export type ThreatLevel = 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CompromisedResult {
  /** True if risk score >= 30 (rooted or above) */
  compromised: boolean;
  threatLevel: ThreatLevel;
  /** Risk score 0–100 based on weighted signals */
  score: number;
  /** Which signals fired */
  signals: string[];
  /** Recommended action for the consuming app */
  recommendation: string;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/** Run all security checks. Returns the full result object. */
export async function runSecurityChecks(): Promise<SecurityScanResult> {
  return ShieldScan.runSecurityChecks();
}

// ─── Risk Engine ──────────────────────────────────────────────────────────────

/**
 * Enterprise-grade device risk assessment.
 *
 * Uses weighted scoring instead of flat boolean OR.
 * Allows apps to make tiered decisions based on threat level.
 *
 * Signal weights:
 *  CRITICAL (40pts) — fridaDetected, hooksDetected  → active runtime attack
 *  HIGH     (30pts) — rooted                        → OS integrity broken
 *  MEDIUM   (20pts) — fileBasedRoot                 → artifacts present
 *  LOW      (10pts) — debugger                      → suspicious in prod
 *  LOW      (5pts)  — developerMode                 → elevated risk surface
 *  INFO     (0pts)  — emulator                      → excluded from score
 *
 * Note: developerMode alone (score=5) does NOT mark device as compromised.
 * It contributes to score but threshold for compromised is 30 (rooted+).
 * This ensures normal devs/QA with dev options on are never blocked.
 */
export async function getDeviceRiskAssessment(): Promise<CompromisedResult> {
  const result = await runSecurityChecks();
  const signals: string[] = [];
  let score = 0;

  // CRITICAL — active runtime instrumentation (block immediately)
  if (result.fridaDetected) { score += 40; signals.push('fridaDetected'); }
  if (result.hooksDetected) { score += 40; signals.push('hooksDetected'); }

  // HIGH — OS security model broken
  if (result.rooted)        { score += 30; signals.push('rooted'); }

  // MEDIUM — artifacts present, not confirmed active
  if (result.fileBasedRoot) { score += 20; signals.push('fileBasedRoot'); }

  // LOW — suspicious in production, expected in development
  if (result.debugger)      { score += 10; signals.push('debugger'); }

  // LOW — elevated attack surface but legitimate in dev/QA
  // Weight is intentionally small (5pts) so developer mode alone
  // never triggers a block. Combined with other signals it raises score.
  if (result.developerMode) { score += 5;  signals.push('developerMode'); }

  // INFO — never contributes to score, logged only
  // Many teams run QA on emulators — emulator alone is never a block signal.
  if (result.emulator)      { signals.push('emulator'); }

  const finalScore = Math.min(score, 100);
  const threatLevel = getThreatLevel(finalScore);

  return {
    compromised: finalScore >= 30,
    threatLevel,
    score: finalScore,
    signals,
    recommendation: getRecommendation(threatLevel, signals),
  };
}

/**
 * Simple boolean gate — backward compatible.
 * Returns true if risk score >= 30 (rooted or any critical signal).
 *
 * Note: developerMode alone returns false (score = 5, below threshold).
 * Note: emulator alone returns false (score = 0, excluded from scoring).
 */
export async function isDeviceCompromised(): Promise<boolean> {
  const { compromised } = await getDeviceRiskAssessment();
  return compromised;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThreatLevel(score: number): ThreatLevel {
  if (score === 0)  return 'CLEAN';
  if (score < 20)   return 'LOW';
  if (score < 40)   return 'MEDIUM';
  if (score < 70)   return 'HIGH';
  return 'CRITICAL';
}

function getRecommendation(level: ThreatLevel, signals: string[]): string {
  switch (level) {
    case 'CLEAN':
      return 'Device is clean. No action required.';
    case 'LOW':
      return 'Low risk detected. Log and monitor. Do not block.';
    case 'MEDIUM':
      return 'Medium risk. Restrict sensitive features (payments, PII). Prompt user.';
    case 'HIGH':
      return 'High risk. Block access to sensitive flows. Require re-authentication.';
    case 'CRITICAL':
      return `Critical threat detected (${signals.filter(s => ['fridaDetected', 'hooksDetected'].includes(s)).join(', ')}). Terminate session immediately.`;
  }
}
