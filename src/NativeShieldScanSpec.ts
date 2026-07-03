import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  runSecurityChecks(): Promise<{
    rooted: boolean;
    fileBasedRoot: boolean;
    fridaDetected: boolean;
    debugger: boolean;
    emulator: boolean;
    hooksDetected: boolean;
    developerMode: boolean;
  }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ShieldScan');
