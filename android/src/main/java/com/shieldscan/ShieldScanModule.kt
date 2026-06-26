package com.shieldscan

import android.os.Build
import android.os.Debug
import com.facebook.react.bridge.*
import com.scottyab.rootbeer.RootBeer
import java.io.File
import java.net.Socket

/**
 * ShieldScanModule
 *
 * Native Android security checks for @noobdigital/react-native-shieldscan.
 * Compatible with both Old Architecture (Bridge) and New Architecture (JSI/TurboModules).
 *
 * Checks performed:
 *  - Root detection via RootBeer library
 *  - File-based root detection (Magisk, Xposed, su binaries)
 *  - Frida detection (file paths + TCP port 27042)
 *  - Emulator detection via Build fingerprint heuristics
 *  - Debugger detection via Debug.isDebuggerConnected()
 */
class ShieldScanModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ShieldScan"

    @ReactMethod
    fun runSecurityChecks(promise: Promise) {
        try {
            val result = Arguments.createMap().apply {
                putBoolean("rooted", isRooted())
                putBoolean("fileBasedRoot", hasSuspiciousFiles())
                putBoolean("fridaDetected", isFridaDetected())
                putBoolean("emulator", isEmulator())
                putBoolean("debugger", Debug.isDebuggerConnected())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SHIELD_SCAN_ERROR", "Security check failed: ${e.message}", e)
        }
    }

    // ─── Root Detection ──────────────────────────────────────────────────────

    /**
     * Uses the RootBeer library for comprehensive root detection.
     * Checks: su binaries, test-keys build, dangerous props, busybox, etc.
     */
    private fun isRooted(): Boolean {
        return try {
            RootBeer(reactContext).isRooted
        } catch (e: Exception) {
            false
        }
    }

    /**
     * File-based detection for known root/hooking framework artifacts.
     * Covers: Magisk, SuperSU, Xposed Framework, Frida temp files.
     */
    private fun hasSuspiciousFiles(): Boolean {
        val suspiciousPaths = listOf(
            // su binaries
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/system/bin/.ext/.su",
            "/system/xbin/daemonsu",
            // SuperSU / Superuser
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk",
            "/system/etc/init.d/99SuperSUDaemon",
            "/system/usr/we-need-root/",
            "/system/app/Kinguser.apk",
            // Magisk
            "/magisk",
            "/data/adb/magisk",
            "/data/adb/magisk.db",
            "/sbin/.magisk",
            "/cache/.disable_magisk",
            // Xposed Framework
            "/system/framework/XposedBridge.jar",
            // Frida temp artifacts
            "/data/local/tmp/frida",
            "/data/local/tmp/re.frida.server",
        )

        return suspiciousPaths.any { File(it).exists() }
    }

    // ─── Frida Detection ─────────────────────────────────────────────────────

    /**
     * Multi-vector Frida detection:
     * 1. Known Frida server file paths
     * 2. Frida gadget shared library
     * 3. Frida default port (27042)
     */
    private fun isFridaDetected(): Boolean {
        return try {
            val fridaPaths = listOf(
                "/data/local/tmp/frida-server",
                "/data/local/tmp/re.frida.server",
                "/system/lib/libfrida-gadget.so",
                "/system/lib64/libfrida-gadget.so",
            )

            if (fridaPaths.any { File(it).exists() }) return true

            isFridaPortOpen(27042)
        } catch (_: Exception) {
            false
        }
    }

    private fun isFridaPortOpen(port: Int): Boolean {
        return try {
            Socket("127.0.0.1", port).use { true }
        } catch (_: Exception) {
            false
        }
    }

    // ─── Emulator Detection ──────────────────────────────────────────────────

    /**
     * Heuristic emulator detection via Build constants.
     * Note: intentionally excludes adbEnabled / canMockLocation to avoid
     * false positives on BrowserStack devices and CI environments.
     */
    private fun isEmulator(): Boolean {
        return Build.FINGERPRINT.contains("generic")
            || Build.FINGERPRINT.contains("unknown")
            || Build.MODEL.contains("google_sdk")
            || Build.MODEL.contains("Emulator")
            || Build.MODEL.contains("Android SDK built for x86")
            || Build.MANUFACTURER.contains("Genymotion")
            || Build.BRAND.startsWith("generic")
            || Build.DEVICE.startsWith("generic")
            || Build.PRODUCT.contains("sdk_gphone")
            || Build.HARDWARE.contains("goldfish")
            || Build.HARDWARE.contains("ranchu")
    }
}
