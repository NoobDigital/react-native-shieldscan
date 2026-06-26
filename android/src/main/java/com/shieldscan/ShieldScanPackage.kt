package com.shieldscan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage registration for ShieldScan.
 *
 * For React Native 0.73+, auto-linking handles this automatically
 * via the react-native.config.js. Manual registration is only needed
 * for older setups or when auto-link is disabled.
 */
class ShieldScanPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(ShieldScanModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}
