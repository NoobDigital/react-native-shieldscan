# @noobdigital/react-native-shieldscan

[![npm version](https://img.shields.io/npm/v/@noobdigital/react-native-shieldscan.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![npm downloads](https://img.shields.io/npm/dm/@noobdigital/react-native-shieldscan.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![license](https://img.shields.io/npm/l/@noobdigital/react-native-shieldscan.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-ios%20%7C%20android-lightgrey.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![architecture](https://img.shields.io/badge/new%20arch-supported-brightgreen.svg)](https://reactnative.dev/docs/the-new-architecture/landing-page)

Runtime security detection for React Native apps. Detects jailbreak, root, Frida instrumentation, debugger attachment, emulator environments, runtime hooking frameworks, and developer mode — in a single native call.

Supports **Old Architecture** (Bridge) and **New Architecture** (Turbo Modules / JSI). React Native 0.70+.

---

## Features

| Check | iOS | Android |
|---|---|---|
| Jailbreak / Root | ✅ File paths + sandbox write test + symlink check | ✅ RootBeer `0.1.2` |
| File-based root | ✅ Cydia, MobileSubstrate, bash, sshd | ✅ Magisk, SuperSU, Xposed, Zygisk paths |
| Frida detection | ✅ dylib injection + port 27042 + env var | ✅ File paths + port 27042 + `/proc/self/maps` |
| Debugger attached | ✅ `kinfo_proc` / `P_TRACED` via `sysctl` | ✅ `Debug.isDebuggerConnected()` + `waitingForDebugger()` + `TracerPid` |
| Emulator / Simulator | ✅ `targetEnvironment(simulator)` | ✅ Build fingerprint + sensor count heuristic (covers Bluestacks, Nox, LDPlayer, Genymotion, MEmu) |
| Hooking frameworks | ✅ dyld image scan (Substrate, Substitute, LibHooker) | ✅ Package scan + stack trace probe + `/proc/self/maps` (Xposed, LSPosed, Frida gadget, SandHook) |
| Developer mode | ✅ Always `false` (no public iOS API) | ✅ `Settings.Secure.DEVELOPMENT_SETTINGS_ENABLED` |

---

## Screenshots

Example app running on Android emulator and iOS Simulator. `Running on Emulator: TRUE` confirms emulator detection is working correctly on both platforms.

<p align="center">
  <img src="example/screenshots/Android.png" width="280" alt="ShieldScan on Android" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="example/screenshots/Ios.png" width="280" alt="ShieldScan on iOS" />
</p>
<p align="center">
  <sub>Android (left) &nbsp;·&nbsp; iOS (right)</sub>
</p>

---

## Installation

```sh
npm install @noobdigital/react-native-shieldscan
# or
yarn add @noobdigital/react-native-shieldscan
```

### iOS

```sh
cd ios && pod install
```

Auto-linked via React Native 0.60+ auto-linking. No manual steps required.

### Android

Auto-linked via React Native 0.60+ auto-linking. No manual steps required.

For older setups, register manually in `MainApplication.kt`:

```kotlin
import com.shieldscan.ShieldScanPackage

// inside getPackages():
packages.add(ShieldScanPackage())
```

---

## Usage

### Full result object

```typescript
import { runSecurityChecks } from '@noobdigital/react-native-shieldscan';

const result = await runSecurityChecks();

console.log(result);
// {
//   rooted:        false,
//   fileBasedRoot: false,
//   fridaDetected: false,
//   debugger:      false,
//   emulator:      false,
//   hooksDetected: false,
//   developerMode: false,
// }
```

### Single boolean gate

```typescript
import { isDeviceCompromised } from '@noobdigital/react-native-shieldscan';

const compromised = await isDeviceCompromised();

if (compromised) {
  Alert.alert('Security Error', 'This app cannot run on a compromised device.');
}
```

### Enterprise — risk scoring engine (v1.0.2+)

```typescript
import { getDeviceRiskAssessment } from '@noobdigital/react-native-shieldscan';

const assessment = await getDeviceRiskAssessment();

console.log(assessment);
// {
//   compromised:    false,
//   threatLevel:    'CLEAN',   // CLEAN | LOW | MEDIUM | HIGH | CRITICAL
//   score:          0,         // 0–100 weighted risk score
//   signals:        [],        // which signals fired
//   recommendation: 'Device is clean. No action required.'
// }
```

Tiered response based on threat level:

```typescript
switch (assessment.threatLevel) {
  case 'CLEAN':
    // proceed normally
    break;
  case 'LOW':
    // log only — e.g. developer mode on, expected in dev/QA
    break;
  case 'MEDIUM':
    // restrict sensitive features (payments, PII)
    break;
  case 'HIGH':
    // block sensitive flows, require re-authentication
    break;
  case 'CRITICAL':
    // Frida/hooks detected — terminate session immediately
    await revokeSessionToken();
    BackHandler.exitApp();
    break;
}
```

### Recommended — startup enforcement with telemetry

```typescript
import { getDeviceRiskAssessment } from '@noobdigital/react-native-shieldscan';

async function enforceDeviceSecurity() {
  const assessment = await getDeviceRiskAssessment();

  // Always log everything to your security backend
  analytics.track('device_security_assessment', {
    score:       assessment.score,
    threatLevel: assessment.threatLevel,
    signals:     assessment.signals,
    platform:    Platform.OS,
  });

  if (assessment.threatLevel === 'CRITICAL') {
    throw new Error('COMPROMISED_DEVICE');
  }
}
```

---

## API Reference

### `runSecurityChecks(): Promise<SecurityScanResult>`

Runs all security checks natively in a single call. Resolves with a `SecurityScanResult` object. All checks run in parallel on the native side.

### `isDeviceCompromised(): Promise<boolean>`

Convenience wrapper. Returns `true` if the risk score is ≥ 30 — meaning any of `rooted`, `fileBasedRoot`, `fridaDetected`, `debugger`, or `hooksDetected` is `true`.

> **Note:** `emulator` and `developerMode` alone never mark a device as compromised. `emulator` is excluded entirely from scoring. `developerMode` contributes only 5 points — below the 30-point threshold. Check them separately if your threat model requires blocking them.

### `getDeviceRiskAssessment(): Promise<CompromisedResult>`

Enterprise-grade weighted risk assessment. Returns a `CompromisedResult` with threat level, score, active signals, and a recommended action.

Signal weights:

| Signal | Weight | Rationale |
|---|---|---|
| `fridaDetected` | 40 pts | Active runtime instrumentation |
| `hooksDetected` | 40 pts | Active runtime instrumentation |
| `rooted` | 30 pts | OS integrity broken |
| `fileBasedRoot` | 20 pts | Artifacts present, not confirmed active |
| `debugger` | 10 pts | Suspicious in production |
| `developerMode` | 5 pts | Elevated attack surface |
| `emulator` | 0 pts | Informational only |

### `SecurityScanResult`

```typescript
interface SecurityScanResult {
  /**
   * True if RootBeer (Android) or jailbreak file paths (iOS) detect
   * a compromised OS environment. Primary root/jailbreak signal.
   */
  rooted: boolean;

  /**
   * True if known root, jailbreak, or Frida file paths exist on disk.
   * Android: /sbin/su, /magisk, XposedBridge.jar, Zygisk modules
   * iOS: /Applications/Cydia.app, /bin/bash, /usr/sbin/sshd
   */
  fileBasedRoot: boolean;

  /**
   * True if Frida instrumentation framework is detected.
   * Checks: known file paths + TCP port 27042 + environment variables
   * + dylib injection (iOS) + /proc/self/maps scan (Android).
   */
  fridaDetected: boolean;

  /**
   * True if a debugger is currently attached to the process.
   * iOS: sysctl kinfo_proc P_TRACED flag.
   * Android: Debug.isDebuggerConnected() + waitingForDebugger() + TracerPid.
   */
  debugger: boolean;

  /**
   * True if running on an Android emulator or iOS Simulator.
   * iOS: compile-time targetEnvironment(simulator).
   * Android: Build fingerprint heuristics + sensor count (< 5 sensors).
   * Covers: AOSP, Genymotion, Bluestacks, Nox, LDPlayer, MEmu, Andy, Droid4X.
   */
  emulator: boolean;

  /**
   * True if a runtime hooking framework is detected.
   * iOS: dyld image scan for Substrate, Substitute, LibHooker, TweakInject.
   * Android: package scan (Xposed/LSPosed managers) + stack trace probe
   *          + /proc/self/maps scan for XposedBridge, frida-gadget, SandHook.
   */
  hooksDetected: boolean;

  /**
   * True if developer options/mode is enabled on the device.
   * Android: Settings.Secure.DEVELOPMENT_SETTINGS_ENABLED.
   * iOS: Always false — no public API exposes developer mode on iOS.
   */
  developerMode: boolean;
}
```

### `CompromisedResult`

```typescript
interface CompromisedResult {
  /** True if risk score >= 30 */
  compromised: boolean;
  /** CLEAN | LOW | MEDIUM | HIGH | CRITICAL */
  threatLevel: ThreatLevel;
  /** Weighted risk score 0–100 */
  score: number;
  /** Which signals fired */
  signals: string[];
  /** Recommended action for the consuming app */
  recommendation: string;
}
```

---

## Example App

A working example app is included in the repository under `example/SampleApp/`.

It demonstrates all seven security checks with a live result screen including risk score card, threat level indicator, and per-check severity badges:

```
example/
  SampleApp/
    src/
      SampleAppScreen.tsx   ← main demo screen
      assets/
        noobdigital-logo.png
```

### Running the example

```sh
# Clone the repo
git clone https://github.com/NoobDigital/react-native-shieldscan.git
cd react-native-shieldscan

# Install dependencies
yarn install

# iOS
cd example/SampleApp && yarn install
cd ios && pod install && cd ..
yarn ios

# Android
cd example/SampleApp && yarn install
yarn android
```

---

## Architecture

### Old Architecture (`newArchEnabled=false`)

Module resolved via `NativeModules.ShieldScan` through the standard React Native bridge.

### New Architecture (`newArchEnabled=true`, React Native 0.71+)

Module resolved via `TurboModuleRegistry.get('ShieldScan')` through JSI. The TypeScript spec in `src/NativeShieldScanSpec.ts` drives codegen for type-safe native bindings with zero bridge serialisation overhead.

The package detects which architecture is active at runtime and selects the appropriate resolution path automatically.

---

## Security Notes

**False positive guarantee**
`hooksDetected` returns `false` on BrowserStack, LambdaTest, Firebase Test Lab, AWS Device Farm real devices, and any device with ADB enabled, developer options on, or corporate/MDM certificates installed. Only genuine hooking framework artifacts trigger this signal.

**`developerMode` in production**
`developerMode: true` alone does not mark a device as compromised — it contributes only 5 points to the risk score, well below the 30-point threshold. It is an informational signal. Guard hard blocks with `!__DEV__` to avoid blocking your own development workflow.

**Simulator / emulator**
`emulator: true` never contributes to the risk score. It is excluded from `isDeviceCompromised()`. Many teams run QA on emulators — this signal is informational only unless you explicitly require blocking it.

**Debugger flag in development**
`debugger: true` is expected during Xcode and Android Studio debug sessions. Guard hard blocks with `!__DEV__`.

**Frida port check latency**
The TCP socket probe to `127.0.0.1:27042` adds approximately 50–300ms on a clean device (connection refused with explicit timeout). This is acceptable for a one-time startup check. Avoid calling `runSecurityChecks()` in render loops or hot paths.

**RootBeer version**
Android root detection uses RootBeer `0.1.2`, which includes 16 KB ELF page size alignment required for Android 15+ / Google Play compliance from November 2025.

**Simulator guards on iOS**
Jailbreak and hook detection checks are disabled at compile time on the iOS Simulator via `#if targetEnvironment(simulator)`. This prevents false positives from macOS filesystem paths (e.g. `/bin/bash`) that exist on the simulator host but are not jailbreak indicators.

---

## VAPT Compliance

Developed and validated against OWASP Mobile Top 10:

| VAPT Finding | OWASP Reference | ShieldScan Signal |
|---|---|---|
| App does not detect jailbroken/rooted devices | M8, M9 | `rooted`, `fileBasedRoot` |
| Frida can attach and instrument the app at runtime | M10 | `fridaDetected`, `hooksDetected` |
| No debugger detection mechanism | M8 | `debugger` |
| Hooking frameworks (Xposed, Substrate) not detected | M10 | `hooksDetected` |
| App runs on emulator without restriction | M8 | `emulator` |
| Developer options not detected | M8 | `developerMode` |

---

## Contributing

Pull requests are welcome.

Before submitting:

```sh
yarn lint        # must pass
yarn typecheck   # must pass
yarn test        # must pass
```

New detection checks must include:
- Native implementation for both iOS (Swift) and Android (Kotlin)
- Corresponding field in `SecurityScanResult` TypeScript interface
- Unit tests in `__tests__/`
- Documentation update in this README

---

## License

MIT © [noobdigital](https://noobdigital.com)