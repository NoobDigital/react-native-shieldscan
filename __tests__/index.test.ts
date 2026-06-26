import { NativeModules } from 'react-native';
import { runSecurityChecks, isDeviceCompromised } from '../src/index';

// ─── Mock NativeModules.ShieldScan ───────────────────────────────────────────

const mockRunSecurityChecks = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    ShieldScan: {
      runSecurityChecks: mockRunSecurityChecks,
    },
  },
  Platform: {
    select: (obj: Record<string, string>) => obj['ios'] ?? '',
  },
}));

// Mock the Turbo Module path to return null (simulate Old Arch in tests)
jest.mock('../src/NativeShieldScan', () => null);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('@noobdigital/react-native-shieldscan', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runSecurityChecks()', () => {
    it('returns all false on a clean device', async () => {
      const clean = {
        rooted: false,
        fileBasedRoot: false,
        fridaDetected: false,
        debugger: false,
        emulator: false,
      };
      mockRunSecurityChecks.mockResolvedValue(clean);

      const result = await runSecurityChecks();
      expect(result).toEqual(clean);
      expect(mockRunSecurityChecks).toHaveBeenCalledTimes(1);
    });

    it('returns rooted=true on a compromised device', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: true,
        fileBasedRoot: true,
        fridaDetected: false,
        debugger: false,
        emulator: false,
      });

      const result = await runSecurityChecks();
      expect(result.rooted).toBe(true);
      expect(result.fileBasedRoot).toBe(true);
    });

    it('returns fridaDetected=true when Frida is running', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: false,
        fileBasedRoot: false,
        fridaDetected: true,
        debugger: false,
        emulator: false,
      });

      const result = await runSecurityChecks();
      expect(result.fridaDetected).toBe(true);
    });

    it('propagates native errors correctly', async () => {
      mockRunSecurityChecks.mockRejectedValue(
        new Error('SHIELD_SCAN_ERROR: Security check failed')
      );

      await expect(runSecurityChecks()).rejects.toThrow('SHIELD_SCAN_ERROR');
    });
  });

  describe('isDeviceCompromised()', () => {
    it('returns false on a clean device', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: false,
        fileBasedRoot: false,
        fridaDetected: false,
        debugger: false,
        emulator: false,
      });

      expect(await isDeviceCompromised()).toBe(false);
    });

    it('returns true if rooted', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: true, fileBasedRoot: false, fridaDetected: false, debugger: false, emulator: false,
      });
      expect(await isDeviceCompromised()).toBe(true);
    });

    it('returns true if Frida detected', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: false, fileBasedRoot: false, fridaDetected: true, debugger: false, emulator: false,
      });
      expect(await isDeviceCompromised()).toBe(true);
    });

    it('returns true if debugger attached', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: false, fileBasedRoot: false, fridaDetected: false, debugger: true, emulator: false,
      });
      expect(await isDeviceCompromised()).toBe(true);
    });

    it('returns false if only emulator (emulator is not a threat by default)', async () => {
      mockRunSecurityChecks.mockResolvedValue({
        rooted: false, fileBasedRoot: false, fridaDetected: false, debugger: false, emulator: true,
      });
      // emulator alone should NOT trigger isDeviceCompromised
      expect(await isDeviceCompromised()).toBe(false);
    });
  });
});
