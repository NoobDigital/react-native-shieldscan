import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { runSecurityChecks, isDeviceCompromised } from '@noobdigital/react-native-shieldscan';

export default function SampleAppScreen() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [compromised, setCompromised] = useState<boolean | null>(null);

  useEffect(() => {
    async function runChecks() {
      try {
        const res = await runSecurityChecks();
        setResults(res);

        const compromisedStatus = await isDeviceCompromised();
        setCompromised(compromisedStatus);

      } catch (e) {
        setResults({ error: e?.message || 'Unknown error' });
      } finally {
        setLoading(false);
      }
    }

    runChecks();
  }, []);

  const renderItem = (label: string, value: boolean | string) => (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          value === true ? styles.red : value === false ? styles.green : styles.yellow,
        ]}
      >
        {String(value).toUpperCase()}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Running ShieldScan checks…</Text>
      </View>
    );
  }

  if (!results) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorText}>Failed to load security results.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.centerContainer}>

      {/* Branding Section */}
      <View style={styles.footer}>
        <Image
          source={require('./assets/noobdigital-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <TouchableOpacity onPress={() => Linking.openURL('https://noobdigital.com')}>
          <Text style={styles.footerText}>www.noobdigital.com</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>ShieldScan Security Report</Text>

        {renderItem(
        Platform.OS === 'android' ? 'Rooted (Android)' : 'Jailbroken (iOS)',
        results.rooted
        )}

      {renderItem('File-Based Root', results.fileBasedRoot)}
      {renderItem('Frida Detected', results.fridaDetected)}
      {renderItem('Debugger Attached', results.debugger)}
      {renderItem('Running on Emulator', results.emulator)}
      {renderItem('Hooking Framework Detected', results.hooksDetected)}

      {/* NEW: Single Boolean Gate */}
      {renderItem('Device Compromised', compromised === true)}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 25,
    marginTop: 25,
    textAlign: 'center',
  },

  item: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
  },

  label: {
    fontSize: 14,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
  },

  red: { color: '#d9534f' },
  green: { color: '#5cb85c' },
  yellow: { color: '#f0ad4e' },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },

  errorText: {
    fontSize: 18,
    color: '#d9534f',
  },

  footer: {
    marginTop: 40,
    alignItems: 'center',
  },

  logo: {
    width: 120,
    height: 80,
    marginBottom: 2,
  },

  footerText: {
    fontSize: 14,
    color: '#777',
    fontWeight: '500',
    textAlign: 'center',
  },
});
