import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// ─── Security checks result ───────────────────────────────────────────────────

export interface SecurityScanResult {
  rooted: boolean;
  fileBasedRoot: boolean;
  fridaDetected: boolean;
  debugger: boolean;
  emulator: boolean;
  hooksDetected: boolean;
  developerMode: boolean;
}

// ─── Screen security results ──────────────────────────────────────────────────

export interface BlurResult {
  blurEnabled: boolean;
}

export interface ScreenshotPreventionResult {
  screenshotPreventionEnabled: boolean;
}

export interface ScreenRecordingResult {
  isRecording: boolean;
  note?: string; // Android only — informational
}

// ─── TurboModule Spec ─────────────────────────────────────────────────────────

export interface Spec extends TurboModule {
  // ── Core security checks
  runSecurityChecks(): Promise<SecurityScanResult>;

  // ── Background blur
  // Enable/disable blur when app moves to background.
  // Per-screen: call with true on sensitive screens, false when leaving.
  setBlurEnabled(enabled: boolean): Promise<BlurResult>;

  // ── Screenshot & recording prevention
  // When enabled: screenshots return blank image, recording is blocked.
  // Per-screen: call with true on card/payment screens, false when leaving.
  setScreenshotPreventionEnabled(enabled: boolean): Promise<ScreenshotPreventionResult>;

  // ── Screen recording detection
  // iOS: returns true if UIScreen.isCaptured is true.
  // Android: always false (FLAG_SECURE prevents recording at OS level).
  isScreenBeingRecorded(): Promise<ScreenRecordingResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ShieldScan');
