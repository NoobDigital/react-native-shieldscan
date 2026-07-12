import { NativeModules, Platform } from 'react-native';
import NativeShieldScan from './NativeShieldScan';
import { useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityScanResult {
  rooted: boolean;
  fileBasedRoot: boolean;
  fridaDetected: boolean;
  debugger: boolean;
  emulator: boolean;
  hooksDetected: boolean;
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
  compromised: boolean;
  threatLevel: ThreatLevel;
  score: number;
  signals: string[];
  recommendation: string;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

export async function runSecurityChecks(): Promise<SecurityScanResult> {
  return ShieldScan.runSecurityChecks();
}

// ─── Risk Engine ──────────────────────────────────────────────────────────────

export async function getDeviceRiskAssessment(): Promise<CompromisedResult> {
  const result = await runSecurityChecks();
  const signals: string[] = [];
  let score = 0;

  if (result.fridaDetected) { score += 40; signals.push('fridaDetected'); }
  if (result.hooksDetected) { score += 40; signals.push('hooksDetected'); }
  if (result.rooted)        { score += 30; signals.push('rooted'); }
  if (result.fileBasedRoot) { score += 20; signals.push('fileBasedRoot'); }
  if (result.debugger)      { score += 10; signals.push('debugger'); }
  if (result.developerMode) { score += 5;  signals.push('developerMode'); }
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

export async function isDeviceCompromised(): Promise<boolean> {
  const { compromised } = await getDeviceRiskAssessment();
  return compromised;
}

// ─── REQUIRED UPDATE: Screen Security APIs (merged into ShieldScan) ───────────

/**
 * Enable or disable background blur for the current screen.
 */
export async function setBlurEnabled(enabled: boolean) {
  return ShieldScan.setBlurEnabled(enabled);
}

/**
 * Enable or disable screenshot and screen recording prevention.
 */
export async function setScreenshotPreventionEnabled(enabled: boolean) {
  return ShieldScan.setScreenshotPreventionEnabled(enabled);
}

/**
 * Returns whether the screen is currently being recorded.
 */
export async function isScreenBeingRecorded() {
  if (Platform.OS === 'android') {
    return { isRecording: false, note: 'Android < 15 does not support recording detection' };
  }
  return ShieldScan.isScreenBeingRecorded();
}


export function useScreenSecurity(options: {
  blur?: boolean;
  screenshotPrevention?: boolean;
}) {
  useEffect(() => {
    if (options.blur) setBlurEnabled(true);
    if (options.screenshotPrevention) setScreenshotPreventionEnabled(true);

    return () => {
      if (options.blur) setBlurEnabled(false);
      if (options.screenshotPrevention) setScreenshotPreventionEnabled(false);
    };
  }, []);
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
