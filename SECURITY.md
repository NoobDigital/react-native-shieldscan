# Security Policy

## Supported Versions

Security fixes are normally applied to the latest published version. Older versions may not receive patches.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | Best effort |

Users should upgrade to the latest stable version before reporting an issue.

## Reporting a Vulnerability

**Do not open a public GitHub issue for a suspected vulnerability.**

Preferred reporting method:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability** to create a private advisory.
3. If private vulnerability reporting is unavailable, contact the maintainer privately through the GitHub profile at https://github.com/NoobDigital and request a secure reporting channel. Do not include exploit details in a public message.

Please include:

- A clear description and affected package version
- Affected platform, OS version, and React Native architecture
- Reproduction steps or a minimal private reproduction
- Impact and realistic attack scenario
- Proof-of-concept material, if safe to share privately
- Any suggested mitigation

Remove credentials, personal data, production identifiers, signing material, and unrelated secrets.

## Response Expectations

This is a community-maintained project. The maintainer aims to:

- Acknowledge a complete report within 5 business days
- Provide an initial assessment within 10 business days
- Coordinate remediation and disclosure based on severity and complexity

These targets are not a service-level agreement. Please allow reasonable time for investigation and a release before public disclosure.

## Disclosure Process

When a report is accepted, the maintainer will attempt to:

1. Confirm the affected versions and impact.
2. Develop and test a fix or mitigation.
3. Prepare a release and security advisory.
4. Credit the reporter if requested and appropriate.
5. Coordinate a reasonable public disclosure date.

## Security Scope

In scope:

- Vulnerabilities introduced by this package's JavaScript, TypeScript, Android, iOS, build, or release code
- Unsafe defaults or behavior that materially weakens an application's security
- Dependency or supply-chain issues specific to this package
- Unauthorized data exposure caused by the package

Generally out of scope:

- Vulnerabilities in React Native, Android, iOS, npm, CocoaPods, Gradle, or other upstream dependencies unless this package uses them unsafely
- Social engineering, denial-of-service against community infrastructure, or reports without a plausible security impact
- Issues that require an already fully compromised device without increasing attacker capability
- Missing features presented as vulnerabilities

### Product-Specific Limitations

ShieldScan provides local runtime security signals as one layer of a defence-in-depth strategy. Root, jailbreak, debugger, emulator, hooking, and instrumentation detection can be bypassed on sufficiently compromised devices. A bypass is most useful as a report when it demonstrates a concrete weakness introduced by this package and includes a safe reproduction. The package is not a replacement for server-side authorization, secure credential handling, code signing, or platform attestation.

## Safe Harbor

Good-faith research that avoids privacy violations, data destruction, service disruption, and unauthorized access will be handled constructively. This policy does not authorize testing against systems, applications, or devices you do not own or have explicit permission to test.
