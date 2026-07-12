# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---



## [1.0.3] - 2026-07-13

### Added
- Screen Security (v1.1.0+)
  - Background blur  
    - iOS: overlay shown on `willResignActive`, removed on `didBecomeActive`  
    - Android: overlay shown on window focus loss (Home / App Switcher), removed on regain
  - Screenshot / screen‑recording prevention  
    - iOS: secure rendering via `UITextField` secure layer trick — blank in screenshots and recordings  
    - Android: `WindowManager.LayoutParams.FLAG_SECURE` — blocks screenshots and recents preview
  - Screen recording detection  
    - iOS: `UIScreen.main.isCaptured` (all OS versions)  
    - Android: supported only on Android 15 (API 35+) via `WindowManager.addScreenRecordingCallback`

### Notes
- Android platform limitation:  
  When `FLAG_SECURE` is enabled, Android blanks the entire recents/app‑switcher snapshot.  
  This is a system‑level restriction — the blur overlay **cannot** appear simultaneously because the OS refuses to render any content (including overlays) into the snapshot.  
  iOS does not have this conflict; both blur and screenshot prevention can operate independently.


## [1.0.2] - 2026-07-03

### Added
- `developerMode` detection — Android: Developer Options via `Settings.Secure`, iOS: always `false`
- `getDeviceRiskAssessment()` — weighted risk scoring engine returning `threatLevel`, `score` (0–100), `signals[]`, and `recommendation`
- Five threat levels: `CLEAN` / `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`
- `CompromisedResult` TypeScript type exported from package root
- Native debugger detection via `TracerPid` in `/proc/self/status` (catches lldb/gdb)
- `Debug.waitingForDebugger()` added to Android debugger check
- Sensor count heuristic for emulator detection (real devices ≥ 15 sensors, emulators < 5)
- Emulator coverage expanded: Bluestacks, Nox, LDPlayer, MEmu, Andy, Droid4X, Genymotion/VirtualBox
- Zygisk path added to suspicious file list (`/data/adb/modules/.zygisk`)
- `codegenConfig` block added to `react-native.config.js`
- `s.swift_version = "5.0"` added to podspec

### Changed
- `isDeviceCompromised()` now uses weighted score threshold (≥ 30) internally — fully backward compatible
- `SecurityScanResult` extended with `developerMode: boolean`
- Android `compileSdkVersion` / `targetSdkVersion` bumped to `35`
- RootBeer bumped `0.1.1` → `0.1.2`
- Example app redesigned with risk score card, threat level indicator, score bar, and severity badges

### Fixed
- `podspec` `dir` → `__dir__` (caused `pod install` crash in consuming apps)
- `podspec` `source_files` glob `ios/*/*.` → `ios/**/*.` (recursive)
- `hooksDetected` false positives eliminated:
  - Removed `isAdbRootOrDebuggable()` (flagged BrowserStack / Firebase / LambdaTest real devices)
  - Removed duplicate `hasEdXposedInstalled()` call
  - Replaced broad `"frida"` substring → specific `"frida-agent"` / `"frida-gadget"`
  - Replaced broad `"epic"` substring → path-based `"/epic/"` (avoids `libepic_perf.so` on Samsung/Huawei)
  - Replaced broad `"xposed"` substring → specific `"XposedBridge"`
  - `/proc/self/maps` scanner now checks pathname column only — skips anonymous mappings
- Removed `Build.USER == "android-build"` from emulator detection (false positive on Firebase Test Lab / AWS Device Farm real devices)
- Removed `Build.TAGS.contains("test-keys")` from emulator detection (false positive on some OEM builds)

---

## [1.0.1] - 2026-06-27

### Added
- `hooksDetected` field added to `SecurityScanResult`
  - iOS: dyld image scan for Substrate, Substitute, LibHooker, TweakInject
  - Android: `/proc/self/maps` scan for Xposed, LSPosed, EdXposed, SandHook, Epic, Frida gadget
- `hooksDetected` included in `isDeviceCompromised()` check
- `hooksDetected` mapped to OWASP M10 in documentation
- Example app (`example/SampleApp/`) added to repository
- Screenshots added to README (Android + iOS)

### Changed
- README overhauled — badges, full `SecurityScanResult` JSDoc, VAPT compliance table, example app section, architecture section
- RootBeer bumped `0.1.0` → `0.1.1` (16 KB ELF page alignment for Android 15+ / Google Play November 2025 compliance)

### Fixed
- `NativeShieldScan.ts` TurboModule spec missing `hooksDetected` — caused `bob build` failure blocking npm publish

---

## [1.0.0] - 2026-06-26

### Added
- Initial release
- iOS: jailbreak detection (file paths, sandbox write test, symlink check)
- iOS: Frida detection (dylib injection, port 27042, environment variable)
- iOS: debugger detection via `sysctl` / `kinfo_proc` P_TRACED flag
- iOS: simulator detection via `targetEnvironment(simulator)`
- iOS: hooking framework detection via dyld image scan
- Android: root detection via RootBeer `0.1.0`
- Android: file-based root detection (Magisk, SuperSU, Xposed, Frida paths)
- Android: Frida detection (file paths + TCP port 27042)
- Android: emulator detection via `Build` fingerprint heuristics
- Android: debugger detection via `Debug.isDebuggerConnected()`
- Old Architecture (Bridge) and New Architecture (Turbo Modules / JSI) support
- `runSecurityChecks()` and `isDeviceCompromised()` public API
- TypeScript types for all public API

---

[1.0.2]: https://github.com/NoobDigital/react-native-shieldscan/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/NoobDigital/react-native-shieldscan/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/NoobDigital/react-native-shieldscan/releases/tag/v1.0.0
