# @noobdigital/react-native-shieldscan

Runtime security checks for React Native apps — jailbreak/root detection, Frida instrumentation detection, debugger detection, and emulator detection.

Supports **Old Architecture** (Bridge) and **New Architecture** (Turbo Modules / JSI), React Native 0.70+.

---

## Features

| Check | iOS | Android |
|---|---|---|
| Jailbreak / Root | ✅ File path + write test + symlink | ✅ RootBeer library |
| File-based root | ✅ Cydia, MobileSubstrate, bash, ssh | ✅ Magisk, SuperSU, Xposed |
| Frida detection | ✅ dylib injection + port 27042 + env var | ✅ File paths + port 27042 |
| Debugger attached | ✅ ptrace / kinfo_proc P_TRACED | ✅ Debug.isDebuggerConnected() |
| Emulator / Simulator | ✅ targetEnvironment(simulator) | ✅ Build fingerprint heuristics |

---

## Installation

```sh
npm install @noobdigital/react-native-shieldscan
# or
yarn add @noobdigital/react-native-shieldscan
```

### iOS (auto-linked)

```sh
cd ios && pod install
```

### Android

Auto-linked via React Native 0.60+ auto-linking. No manual steps needed.

If you're on an older setup, add to `MainApplication.kt`:

```kotlin
import com.shieldscan.ShieldScanPackage

// inside getPackages():
packages.add(ShieldScanPackage())
```

---

## Usage

### Basic — full result object

```typescript
import { runSecurityChecks } from '@noobdigital/react-native-shieldscan';

const result = await runSecurityChecks();
console.log(result);
// {
//   rooted: false,
//   fileBasedRoot: false,
//   fridaDetected: false,
//   debugger: false,
//   emulator: false,
// }
```

### Convenience — single boolean gate

```typescript
import { isDeviceCompromised } from '@noobdigital/react-native-shieldscan';

// Use at app startup to block access on tampered devices
const compromised = await isDeviceCompromised();
if (compromised) {
  Alert.alert(
    'Security Error',
    'This app cannot run on a compromised device.'
  );
  // Or: RNExitApp.exitApp() / BackHandler.exitApp()
}
```

### Recommended — startup check with telemetry

```typescript
import { runSecurityChecks } from '@noobdigital/react-native-shieldscan';

async function enforceDeviceSecurity() {
  try {
    const result = await runSecurityChecks();

    // Log all signals to your security backend
    analytics.track('device_security_check', result);

    // Hard block on critical threats
    if (result.rooted || result.fridaDetected) {
      throw new Error('COMPROMISED_DEVICE');
    }

    // Soft warn on emulator in production
    if (result.emulator && !__DEV__) {
      console.warn('[ShieldScan] Running on emulator in production');
    }
  } catch (error) {
    // Treat check failure as a security event too
    analytics.track('device_security_check_failed', { error: String(error) });
    throw error;
  }
}
```

---

## API Reference

### `runSecurityChecks(): Promise<SecurityScanResult>`

Runs all checks natively and resolves with a result object.

### `isDeviceCompromised(): Promise<boolean>`

Convenience wrapper. Returns `true` if any of `rooted`, `fileBasedRoot`, `fridaDetected`, or `debugger` is `true`.

> **Note:** `emulator` is intentionally excluded from `isDeviceCompromised()` since many teams allow emulator use in QA environments. Check it separately if needed.

### `SecurityScanResult`

```typescript
interface SecurityScanResult {
  /** RootBeer (Android) or jailbreak paths (iOS) */
  rooted: boolean;

  /** Known root/hooking file paths found on disk */
  fileBasedRoot: boolean;

  /** Frida server files, port 27042, or dylib injection detected */
  fridaDetected: boolean;

  /** Debugger currently attached to the process */
  debugger: boolean;

  /** Running on an Android emulator or iOS Simulator */
  emulator: boolean;
}
```

---

## Architecture

### Old Architecture (React Native < 0.71 or `newArchEnabled=false`)

Uses `NativeModules.ShieldScan` via the standard React Native bridge.

### New Architecture (React Native 0.71+ with `newArchEnabled=true`)

Uses `TurboModuleRegistry.getEnforcing('ShieldScan')` via JSI.
The TypeScript spec in `src/NativeShieldScan.ts` drives codegen for type-safe native bindings.

The module detects which architecture is active at runtime and uses the appropriate path automatically.

---

## Security Notes

- **Emulator false positives:** BrowserStack and some CI cloud devices may trigger `emulator: true`. Treat this as informational rather than a hard block unless your threat model requires it.
- **Rooted development devices:** The `debugger` flag will be `true` during Xcode / Android Studio debug sessions. Exclude it from hard blocks in development builds using `__DEV__`.
- **Frida port check:** The TCP socket connection to `127.0.0.1:27042` adds a small overhead (~50ms on a blocked connection). This is acceptable for a startup check.
- **RootBeer (Android):** Version `0.1.0` is bundled. If your app already includes RootBeer, the Gradle dependency deduplication will handle it.

---

## VAPT Compliance

This package was developed and validated against OWASP Mobile Top 10 checks, specifically:

- **M8 — Security Misconfiguration:** Emulator and debug detection
- **M9 — Insecure Data Storage:** Jailbreak/root detection prevents sandbox bypass
- **M10 — Insufficient Cryptography:** Frida detection prevents runtime key extraction

---

## Contributing

PRs welcome. Please ensure:
- `yarn lint` passes
- `yarn typecheck` passes  
- `yarn test` passes
- New checks have corresponding unit tests in `__tests__/`

---

## License

MIT © noobdigital
