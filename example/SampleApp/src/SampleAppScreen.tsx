import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import {
  runSecurityChecks,
  isDeviceCompromised,
  getDeviceRiskAssessment,
  setBlurEnabled,
  setScreenshotPreventionEnabled,
  isScreenBeingRecorded,
  type CompromisedResult,
  ThreatLevel,
} from '@noobdigital/react-native-shieldscan';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityResults {
  rooted: boolean;
  fileBasedRoot: boolean;
  fridaDetected: boolean;
  debugger: boolean;
  emulator: boolean;
  hooksDetected: boolean;
  developerMode: boolean;
  error?: string;
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const THREAT_COLORS: Record<string, string> = {
  CLEAN:    '#5cb85c',
  LOW:      '#f0ad4e',
  MEDIUM:   '#e67e22',
  HIGH:     '#d9534f',
  CRITICAL: '#c0392b',
};

const THREAT_ICONS: Record<string, string> = {
  CLEAN:    '✅',
  LOW:      '⚠️',
  MEDIUM:   '🔶',
  HIGH:     '🔴',
  CRITICAL: '🚨',
};

type SeverityLevel = ThreatLevel | 'INFO';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  CRITICAL: '#c0392b',
  HIGH:     '#d9534f',
  MEDIUM:   '#e67e22',
  LOW:      '#f0ad4e',
  INFO:     '#3498db',
  CLEAN:    '#5cb85c',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckRow({
  label,
  value,
  severity,
}: {
  label: string;
  value: boolean;
  severity: SeverityLevel;
}) {
  const activeColor = SEVERITY_COLORS[severity];
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkLeft}>
        <Text style={styles.checkLabel}>{label}</Text>
        {value && (
          <View
            style={[
              styles.severityTag,
              { backgroundColor: activeColor + '20', borderColor: activeColor },
            ]}
          >
            <Text style={[styles.severityText, { color: activeColor }]}>{severity}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.checkValue, { color: value ? activeColor : '#5cb85c' }]}>
        {value ? 'TRUE' : 'FALSE'}
      </Text>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
  loading,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIcon}>
        <Text style={styles.toggleIconText}>{icon}</Text>
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#6C63FF" />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#E5E7EB', true: '#6C63FF40' }}
          thumbColor={value ? '#6C63FF' : '#9CA3AF'}
          ios_backgroundColor="#E5E7EB"
        />
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SampleAppScreen() {
  // Security checks state
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<SecurityResults | null>(null);
  const [assessment, setAssessment] = useState<CompromisedResult | null>(null);
  const [deviceCompromised, setDeviceCompromised] = useState<boolean>(false);

  // Screen security state
  const [blurActive, setBlurActive] = useState(false);
  const [screenshotPreventionActive, setScreenshotPreventionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [blurLoading, setBlurLoading] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // ── Load security checks on mount
  useEffect(() => {
    async function runChecks() {
      try {
        const [res, risk, compromised] = await Promise.all([
          runSecurityChecks(),
          getDeviceRiskAssessment(),
          isDeviceCompromised(),
        ]);
        setResults(res as SecurityResults);
        setAssessment(risk);
        setDeviceCompromised(compromised);
      } catch (e: any) {
        setResults({ error: e?.message || 'Unknown error' } as any);
      } finally {
        setLoading(false);
      }
    }
    runChecks();
  }, []);

  // ── Poll screen recording status every 2 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { isRecording: recording } = await isScreenBeingRecorded();
        setIsRecording(recording);
      } catch {
        // non-fatal — ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Cleanup screen security on unmount
  useEffect(() => {
    return () => {
      setBlurEnabled(false).catch(() => {});
      setScreenshotPreventionEnabled(false).catch(() => {});
    };
  }, []);

  // ── Toggle handlers
  const handleBlurToggle = useCallback(async (enabled: boolean) => {
    setBlurLoading(true);
    try {
      await setBlurEnabled(enabled);
      setBlurActive(enabled);
    } catch (e) {
      console.warn('[ShieldScan] setBlurEnabled failed:', e);
    } finally {
      setBlurLoading(false);
    }
  }, []);

  const handleScreenshotToggle = useCallback(async (enabled: boolean) => {
    setScreenshotLoading(true);
    try {
      await setScreenshotPreventionEnabled(enabled);
      setScreenshotPreventionActive(enabled);
    } catch (e) {
      console.warn('[ShieldScan] setScreenshotPreventionEnabled failed:', e);
    } finally {
      setScreenshotLoading(false);
    }
  }, []);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Running ShieldScan checks…</Text>
      </View>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (!results || results.error) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorText}>
          {results?.error ?? 'Failed to load security results.'}
        </Text>
      </View>
    );
  }

  const threatColor = THREAT_COLORS[assessment?.threatLevel ?? 'CLEAN'];
  const threatIcon  = THREAT_ICONS[assessment?.threatLevel ?? 'CLEAN'];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      <View style={styles.branding}>
        <Image
          source={require('./assets/noobdigital-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={() => Linking.openURL('https://noobdigital.com')}>
          <Text style={styles.brandUrl}>www.noobdigital.com</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>ShieldScan Security Report</Text>

      {/* ── Risk Score Card ───────────────────────────────────────────────── */}
      {assessment && (
        <View style={[styles.scoreCard, { borderColor: threatColor }]}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreIcon}>{threatIcon}</Text>
            <View style={styles.scoreTextGroup}>
              <Text style={[styles.scoreLevel, { color: threatColor }]}>
                {assessment.threatLevel}
              </Text>
              <Text style={styles.scoreLabel}>Threat Level</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={[styles.scoreBadgeText, { color: threatColor }]}>
                {assessment.score}
              </Text>
              <Text style={styles.scoreBadgeLabel}>/100</Text>
            </View>
          </View>

          <View style={styles.scoreBarBg}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${assessment.score}%` as any, backgroundColor: threatColor },
              ]}
            />
          </View>

          <Text style={styles.recommendation}>{assessment.recommendation}</Text>

          {assessment.signals.length > 0 && (
            <View style={styles.signalRow}>
              {assessment.signals.map(signal => (
                <View key={signal} style={[styles.signalTag, { borderColor: threatColor }]}>
                  <Text style={[styles.signalText, { color: threatColor }]}>
                    {signal === 'emulator'
                      ? Platform.OS === 'android' ? 'Emulator' : 'Simulator'
                      : signal}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Individual Checks ─────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Individual Checks</Text>

      <CheckRow
        label={Platform.OS === 'android' ? 'Rooted (Android)' : 'Jailbroken (iOS)'}
        value={results.rooted}
        severity="HIGH"
      />
      <CheckRow label="File-Based Root"    value={results.fileBasedRoot}  severity="MEDIUM"   />
      <CheckRow label="Frida Detected"     value={results.fridaDetected}  severity="CRITICAL" />
      <CheckRow label="Debugger Attached"  value={results.debugger}       severity="LOW"      />
      <CheckRow
        label={`Running on ${Platform.OS === 'android' ? 'Emulator' : 'Simulator'}`}
        value={results.emulator}
        severity="INFO"
      />
      <CheckRow label="Hooking Framework"  value={results.hooksDetected}  severity="CRITICAL" />
      <CheckRow label="Developer Mode"     value={results.developerMode}  severity="LOW"      />

      {/* ── Device Compromised Gate ───────────────────────────────────────── */}
      <View
        style={[
          styles.gateCard,
          { backgroundColor: deviceCompromised ? '#FFF0F0' : '#F0FFF4' },
        ]}
      >
        <Text style={styles.gateLabel}>Device Compromised</Text>
        <Text
          style={[
            styles.gateValue,
            { color: deviceCompromised ? '#d9534f' : '#5cb85c' },
          ]}
        >
          {deviceCompromised ? 'YES' : 'NO'}
        </Text>
      </View>

      {/* ── Screen Security Controls ──────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Screen Security</Text>
      <Text style={styles.sectionSubtitle}>
        Enable per-screen to protect sensitive content such as payment or card details screens.
      </Text>

      <View style={styles.securityCard}>

        {/* Screen Recording Detection */}
        <View style={styles.recordingBanner}>
          <Text style={styles.recordingIcon}>{isRecording ? '🔴' : '⚫'}</Text>
          <Text
            style={[
              styles.recordingText,
              { color: isRecording ? '#d9534f' : '#6B7280' },
            ]}
          >
            {isRecording
              ? 'Screen recording detected!'
              : Platform.OS === 'ios'
                ? 'No screen recording detected'
                : 'Recording blocked via FLAG_SECURE'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Background Blur Toggle */}
        <ToggleRow
          icon="🌫️"
          label="Background Blur"
          description={
            Platform.OS === 'ios'
              ? 'Blurs app switcher snapshot when app is backgrounded'
              : Platform.Version >= '31'
                ? 'Native window blur when app is backgrounded (Android 12+)'
                : 'Dark overlay when app is backgrounded (Android <12)'
          }
          value={blurActive}
          onToggle={handleBlurToggle}
          loading={blurLoading}
        />

        <View style={styles.divider} />

        {/* Screenshot Prevention Toggle */}
        <ToggleRow
          icon="📵"
          label="Screenshot Prevention"
          description={
            Platform.OS === 'ios'
              ? 'Screenshots return a blank image (secureTextEntry technique)'
              : 'Blocks screenshots and screen recording via FLAG_SECURE (Android)'
          }
          value={screenshotPreventionActive}
          onToggle={handleScreenshotToggle}
          loading={screenshotLoading}
        />

        {/* Active state indicator */}
        {(blurActive || screenshotPreventionActive) && (
          <View style={styles.activeIndicator}>
            <Text style={styles.activeIndicatorText}>
              🛡️ Screen security is active on this screen
            </Text>
          </View>
        )}

        {/* Usage hint */}
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            💡 In production, use the{' '}
            <Text style={styles.hintCode}>useScreenSecurity</Text>
            {' '}hook to enable protection automatically on sensitive screens:
          </Text>
          <Text style={styles.hintCode}>
            {`useScreenSecurity({ blur: true, screenshotPrevention: true })`}
          </Text>
        </View>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText:  { marginTop: 12, fontSize: 15, color: '#555' },
  errorText:    { fontSize: 16, color: '#d9534f', textAlign: 'center', padding: 20 },

  // ── Branding
  branding:  { marginTop: 40, alignItems: 'center', marginBottom: 4 },
  logo:      { width: 120, height: 80, marginBottom: 2 },
  brandUrl:  { fontSize: 13, color: '#888', fontWeight: '500' },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },

  // ── Score card
  scoreCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  scoreIcon:       { fontSize: 28, marginRight: 12 },
  scoreTextGroup:  { flex: 1 },
  scoreLevel:      { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  scoreLabel:      { fontSize: 12, color: '#999', marginTop: 2 },
  scoreBadge:      { alignItems: 'center' },
  scoreBadgeText:  { fontSize: 28, fontWeight: '800' },
  scoreBadgeLabel: { fontSize: 12, color: '#999' },
  scoreBarBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  scoreBarFill:   { height: 6, borderRadius: 3 },
  recommendation: { fontSize: 13, color: '#444', lineHeight: 20, marginBottom: 12 },
  signalRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  signalTag:      { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  signalText:     { fontSize: 11, fontWeight: '600' },

  // ── Section headers
  sectionTitle: {
    width: '100%',
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionSubtitle: {
    width: '100%',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 18,
  },

  // ── Individual check rows
  checkRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#EFEFEF',
  },
  checkLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  checkLabel:   { fontSize: 14, color: '#222' },
  severityTag:  { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  severityText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  checkValue:   { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  // ── Gate card
  gateCard: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
  },
  gateLabel: { fontSize: 15, fontWeight: '700', color: '#222' },
  gateValue:  { fontSize: 17, fontWeight: '800', letterSpacing: 1 },

  // ── Screen security card
  securityCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Recording banner
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  recordingIcon: { fontSize: 14 },
  recordingText: { fontSize: 13, fontWeight: '500', flex: 1 },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconText: { fontSize: 20 },
  toggleContent:  { flex: 1 },
  toggleLabel:    { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  toggleDesc:     { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },

  // Active indicator
  activeIndicator: {
    margin: 16,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    alignItems: 'center',
  },
  activeIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },

  // Hint box
  hintBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  hintCode: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#6C63FF',
    fontWeight: '600',
  },

  footer: { height: 40 },
});