/**
 * react-native.config.js
 *
 * Tells React Native's auto-link where to find the native package
 * for both Android and iOS. This file is read by `react-native link`
 * and the Metro bundler.
 */
module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: './react-native-shieldscan.podspec',
      },
      android: {
        packageImportPath: 'import com.shieldscan.ShieldScanPackage;',
        packageInstance: 'new ShieldScanPackage()',
      },
    },
  },
};
