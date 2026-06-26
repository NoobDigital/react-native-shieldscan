# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial release
- iOS: jailbreak detection (file paths, write test, symlink check)
- iOS: Frida detection (dylib injection, port 27042, env var)
- iOS: debugger detection via ptrace / kinfo_proc
- iOS: simulator detection via `targetEnvironment(simulator)`
- Android: root detection via RootBeer library
- Android: file-based root detection (Magisk, SuperSU, Xposed, Frida paths)
- Android: Frida port 27042 detection
- Android: emulator detection via Build fingerprint heuristics
- Android: debugger detection via `Debug.isDebuggerConnected()`
- Old Architecture (Bridge) support
- New Architecture (Turbo Modules / JSI) support via codegen spec
- TypeScript types for all public API
- `isDeviceCompromised()` convenience helper
- Full unit test suite
- GitHub Actions CI for lint, typecheck, test, Android build, iOS build
