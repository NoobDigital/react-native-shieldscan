# @noobdigital/react-native-shieldscan

[![npm version](https://img.shields.io/npm/v/@noobdigital/react-native-shieldscan.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![npm downloads](https://img.shields.io/npm/dm/@noobdigital/react-native-shieldscan.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![license](https://img.shields.io/npm/l/@noobdigital/react-native-shieldscan.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-ios%20%7C%20android-lightgrey.svg)](https://www.npmjs.com/package/@noobdigital/react-native-shieldscan)
[![architecture](https://img.shields.io/badge/new%20arch-supported-brightgreen.svg)](https://reactnative.dev/docs/the-new-architecture/landing-page)

Runtime security detection for React Native apps. Detects jailbreak, root, Frida instrumentation, debugger attachment, emulator environments, and runtime hooking frameworks — in a single native call.

Supports **Old Architecture** (Bridge) and **New Architecture** (Turbo Modules / JSI). React Native 0.70+.

---

## Features

| Check | iOS | Android |
|---|---|---|
| Jailbreak / Root | ✅ File paths + sandbox write test + symlink check | ✅ RootBeer `0.1.1` |
| File-based root | ✅ Cydia, MobileSubstrate, bash, sshd | ✅ Magisk, SuperSU, Xposed paths |
| Frida detection | ✅ dylib injection + port 27042 + env var | ✅ File paths + port 27042 |
| Debugger attached | ✅ `kinfo_proc` / `P_TRACED` via `sysctl` | ✅ `Debug.isDebuggerConnected()` |
| Emulator / Simulator | ✅ `targetEnvironment(simulator)` | ✅ Build fingerprint heuristics |
| Hooking frameworks | ✅ dyld image scan (Substrate, Substitute, LibHooker) | ✅ `/proc/self/maps` scan (Xposed, LSPosed, Frida gadget) |

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

### Recommended — startup enforcement with telemetry

```typescript
import { runSecurityChecks } from '@noobdigital/react-native-shieldscan';

async function enforceDeviceSecurity() {
  try {
    const result = await runSecurityChecks();

    // Send all signals to your security backend
    analytics.track('device_security_check', result);

    // Hard block on critical threats
    if (result.rooted || result.fridaDetected || result.hooksDetected) {
      throw new Error('COMPROMISED_DEVICE');
    }

    // Soft warn on emulator in production builds
    if (result.emulator && !__DEV__) {
      console.warn('[ShieldScan] Running on emulator in production');
    }
  } catch (error) {
    analytics.track('device_security_check_failed', { error: String(error) });
    throw error;
  }
}
```

---

## API Reference

### `runSecurityChecks(): Promise<SecurityScanResult>`

Runs all security checks natively in a single call. Resolves with a `SecurityScanResult` object. All checks run in parallel on the native side.

### `isDeviceCompromised(): Promise<boolean>`

Convenience wrapper. Returns `true` if any of `rooted`, `fileBasedRoot`, `fridaDetected`, `debugger`, or `hooksDetected` is `true`.

> **Note:** `emulator` is intentionally excluded from `isDeviceCompromised()`. Many teams permit emulator usage in QA and CI environments. Check `result.emulator` separately if your threat model requires blocking it.

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
   * Android: /sbin/su, /magisk, XposedBridge.jar
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
   * Android: Debug.isDebuggerConnected().
   */
  debugger: boolean;

  /**
   * True if running on an Android emulator or iOS Simulator.
   * iOS: compile-time targetEnvironment(simulator).
   * Android: Build.FINGERPRINT / hardware heuristics.
   */
  emulator: boolean;

  /**
   * True if a runtime hooking framework is detected.
   * iOS: dyld image scan for Substrate, Substitute, LibHooker, TweakInject.
   * Android: /proc/self/maps scan for Xposed, LSPosed, EdXposed,
   *          Frida gadget, SandHook, Epic.
   */
  hooksDetected: boolean;
}
```

---

## Example App

A working example app is included in the repository under `example/SampleApp/`.

It demonstrates all six security checks with a live result screen:

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

The example screen runs all checks on mount and displays each result with colour-coded status (green = safe, red = threat detected).

---

## Architecture

### Old Architecture (`newArchEnabled=false`)

Module resolved via `NativeModules.ShieldScan` through the standard React Native bridge.

### New Architecture (`newArchEnabled=true`, React Native 0.71+)

Module resolved via `TurboModuleRegistry.getEnforcing('ShieldScan')` through JSI. The TypeScript spec in `src/NativeShieldScan.ts` drives codegen for type-safe native bindings with zero bridge serialisation overhead.

The package detects which architecture is active at runtime and selects the appropriate resolution path automatically.

---

## Security Notes

**Simulator / emulator false positives**
BrowserStack, AWS Device Farm, and other cloud device providers may trigger `emulator: true`. Treat this as informational unless your threat model explicitly requires blocking cloud testing environments.

**Debugger flag in development**
`debugger: true` is expected during Xcode and Android Studio debug sessions. Guard hard blocks with `!__DEV__` to avoid blocking your own development workflow.

**Frida port check latency**
The TCP socket probe to `127.0.0.1:27042` adds approximately 50ms on a clean device (connection refused). This is acceptable for a one-time startup check. Avoid calling `runSecurityChecks()` in render loops or hot paths.

**RootBeer version**
Android root detection uses RootBeer `0.1.1`, which includes 16 KB page size alignment required for Android 15+ / Google Play compliance from November 2025.

**Simulator guards on iOS**
Jailbreak and hook detection checks are disabled at compile time on the iOS Simulator via `#if targetEnvironment(simulator)`. This prevents false positives from macOS filesystem paths (e.g. `/bin/bash`) that exist on the simulator host but are not jailbreak indicators.

---

## VAPT Compliance

Developed and validated against OWASP Mobile Top 10:

| OWASP Check | ShieldScan Signal |
|---|---|
| M8 — Security Misconfiguration | `emulator`, `debugger` |
| M9 — Insecure Data Storage | `rooted`, `fileBasedRoot` (sandbox bypass risk) |
| M10 — Insufficient Cryptography | `fridaDetected`, `hooksDetected` (runtime key extraction risk) |

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
