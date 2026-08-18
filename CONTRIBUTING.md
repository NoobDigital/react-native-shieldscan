# Contributing to @noobdigital/react-native-shieldscan

Thank you for considering a contribution. Bug reports, documentation improvements, tests, and focused pull requests are welcome.

## Before You Start

- Search [existing issues](https://github.com/NoobDigital/react-native-shieldscan/issues) and pull requests before opening a new one.
- Use GitHub Issues for confirmed bugs and feature proposals.
- For usage questions, open a GitHub Discussion if Discussions are enabled.
- Do **not** report security vulnerabilities publicly. Follow [SECURITY.md](./SECURITY.md).
- Be respectful and follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Reporting a Bug

Please include:

- Package version
- React Native version
- Node.js and package-manager version
- Platform and OS version
- Device or simulator/emulator details
- Old or New React Native Architecture
- Minimal reproduction repository or reproducible steps
- Expected and actual behavior
- Relevant logs with secrets and personal data removed

Native issues should also include the relevant Xcode, CocoaPods, Gradle, Android Gradle Plugin, Kotlin, or Swift versions.

## Proposing a Feature

Describe the problem first, then the proposed API or behavior. Include platform differences, backward-compatibility concerns, and alternatives you considered. Please wait for maintainer feedback before investing in a large change.

## Development Setup

1. Fork the repository and clone your fork.
2. Create a branch from `main`:

```bash
git checkout -b fix/short-description
```

3. Install dependencies using the package manager represented by the repository lockfile:

```bash
yarn install
```

4. Make the smallest focused change that solves the problem.
5. Add or update tests and documentation.
6. Run the available checks defined in `package.json`, such as linting, type checking, tests, and builds.
7. Test native changes on every affected platform. Prefer a physical device when the feature depends on device-only behavior.

## Coding Guidelines

- Follow the existing TypeScript and native-code style.
- Keep the public API typed and backward compatible where practical.
- Avoid unrelated formatting or dependency changes.
- Add comments only where behavior is not self-explanatory.
- Do not commit generated build output, credentials, signing files, tokens, or local environment files.
- Update the README and changelog when user-visible behavior changes.

## Tests

A pull request should include tests for new behavior and regressions when feasible. If automated testing is not practical for a native behavior, document:

- Devices and OS versions tested
- React Native architecture tested
- Exact manual test steps
- Expected and observed results

For ShieldScan changes, include relevant clean-device and compromised/test-environment coverage where legally and safely possible. Security detections must document possible false positives, false negatives, platform limitations, and bypass assumptions. Never test on systems or devices without authorization.

## Commit and Pull Request Guidelines

Use clear, focused commits. Conventional Commit prefixes are encouraged:

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation only
- `test:` test changes
- `refactor:` internal change without a public behavior change
- `chore:` maintenance work

A pull request should:

- Explain the problem and solution
- Link the related issue when one exists
- List platforms and configurations tested
- Include screenshots or recordings for visible behavior
- Identify breaking changes clearly
- Keep unrelated changes out of the PR

Maintainers may request changes, close stale proposals, or decline changes that do not fit the project scope.

## Release Process

Releases are performed by maintainers. Do not change the package version unless requested. User-visible changes should be documented in `CHANGELOG.md`.

## License

By contributing, you agree that your contribution will be licensed under the repository's existing license.
