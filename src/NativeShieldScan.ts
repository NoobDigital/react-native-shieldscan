import { TurboModuleRegistry, NativeModules } from 'react-native';
import type { Spec } from './NativeShieldScanSpec';

/**
 * NativeShieldScan
 *
 * This file safely loads the ShieldScan native module for BOTH architectures:
 *
 * - New Architecture → TurboModuleRegistry.get<Spec>('ShieldScan')
 * - Old Architecture → NativeModules.ShieldScan
 
 */

const turboModule = TurboModuleRegistry.get<Spec>('ShieldScan');

// If TurboModule is available → use it
// Otherwise → fallback to Old Architecture NativeModules
const ShieldScan = turboModule ?? NativeModules.ShieldScan;

export default ShieldScan;
