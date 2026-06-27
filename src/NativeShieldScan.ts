import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for ShieldScan Turbo Module.
 * This interface is used by React Native's codegen to generate
 * native type-safe bindings for both iOS and Android (New Architecture).
 */
export interface SecurityScanResult {
  /** True if RootBeer (Android) or jailbreak paths (iOS) detect a compromised device */
  rooted: boolean;
  /** True if known root/jailbreak file paths are found on disk */
  fileBasedRoot: boolean;
  /** True if Frida server files or port 27042 are detected */
  fridaDetected: boolean;
  /** True if a debugger is currently attached to the process */
  debugger: boolean;
  /** True if running on an emulator or simulator */
  emulator: boolean;
   /**
   * True if a runtime hooking framework is detected.
   */
  hooksDetected: boolean;
}

export interface Spec extends TurboModule {
  runSecurityChecks(): Promise<SecurityScanResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ShieldScan');
