#import <React/RCTBridgeModule.h>

/**
 * Objective-C bridge for ShieldScan Swift class.
 *
 * This file is required for both Old Architecture (RCTBridgeModule)
 * and New Architecture (it's still needed for the Swift @objc exposure).
 *
 * For New Architecture, the Turbo Module spec in NativeShieldScan.ts
 * drives codegen, but this .mm file handles the JSI binding layer.
 */
@interface RCT_EXTERN_MODULE(ShieldScan, NSObject)

RCT_EXTERN_METHOD(
  runSecurityChecks:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

/**
 * Required for Swift modules: tells React Native this module
 * does NOT need to be initialized on the main thread.
 * Security file checks are safe to run on any thread.
 */
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
