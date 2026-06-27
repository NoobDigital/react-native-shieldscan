package com.shieldscan

import android.os.Build
import android.os.Debug
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.scottyab.rootbeer.RootBeer
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.net.Socket

/**
 * ShieldScanModule
 *
 * Native Android security checks for @noobdigital/react-native-shieldscan.
 * Compatible with both Old Architecture (Bridge) and New Architecture (JSI/TurboModules).
 *
 * Checks performed:
 *  - Root detection via RootBeer library
 *  - File-based root detection (Magisk, SuperSU, su binaries)
 *  - Frida detection (file paths + TCP port 27042)
 *  - Emulator detection via Build fingerprint heuristics
 *  - Debugger detection via Debug.isDebuggerConnected()
 *  - Hooking framework detection (Xposed, EdXposed, LSPosed, Frida gadget/server)
 */
class ShieldScanModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ShieldScan"

    @ReactMethod
    fun runSecurityChecks(promise: Promise) {
        try {
            val isEmulatorDevice = isEmulator()

            val result = Arguments.createMap().apply {
                putBoolean("rooted", isRooted())
                putBoolean("fileBasedRoot", hasSuspiciousFiles())
                putBoolean("fridaDetected", isFridaDetected())
                putBoolean("emulator", isEmulatorDevice)
                putBoolean("debugger", Debug.isDebuggerConnected())

                // Ignore hooking detection on emulator
                val hooks = if (isEmulatorDevice) false else isHookingFrameworkPresent()
                putBoolean("hooksDetected", hooks)
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

    // ─── Hooking Framework Detection ─────────────────────────────────────────

    /**
     * Aggregated detection for common Android runtime hooking frameworks.
     *
     * Targets:
     *  - Xposed / EdXposed / LSPosed managers
     *  - Frida gadget / server
     *  - SandHook / Epic / other hook libs
     *  - Active Xposed/LSPosed via stack trace
     *  - Hooking-related libraries in /proc/self/maps
     *  - ADB + debuggable combination (hook-friendly environment)
     */
    private fun isHookingFrameworkPresent(): Boolean {
        return hasXposedOrManagerInstalled() ||
            hasLSPosedInstalled() ||
            hasEdXposedInstalled() ||
            isXposedActiveByStackTrace() ||
            isHookingLibInProcMaps() ||
            isAdbRootOrDebuggable()
    }

    /**
     * Package-based detection for Xposed and related managers.
     */
    private fun hasXposedOrManagerInstalled(): Boolean {
        val packages = listOf(
            "de.robv.android.xposed.installer",   // classic Xposed
            "com.solohsu.android.edxp.manager",   // EdXposed Manager
            "org.meowcat.edxposed.manager"        // alt EdXposed
        )
        return packages.any { hasPackage(it) }
    }

    private fun hasLSPosedInstalled(): Boolean {
        val packages = listOf(
            "org.lsposed.manager",
            "com.lsposed.manager"
        )
        return packages.any { hasPackage(it) }
    }

    private fun hasEdXposedInstalled(): Boolean {
        val packages = listOf(
            "com.solohsu.android.edxp.manager",
            "org.meowcat.edxposed.manager"
        )
        return packages.any { hasPackage(it) }
    }

    private fun hasPackage(packageName: String): Boolean {
        return try {
            reactContext.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Detect Xposed/LSPosed by inspecting stack traces for known classes.
     */
    private fun isXposedActiveByStackTrace(): Boolean {
        return try {
            throw Exception("ShieldScan stack trace probe")
        } catch (e: Exception) {
            e.stackTrace.any { element ->
                val cls = element.className
                cls.contains("de.robv.android.xposed.XposedBridge") ||
                    cls.contains("de.robv.android.xposed.XC_MethodHook") ||
                    cls.contains("org.lsposed.lspd") ||
                    cls.contains("com.lsposed") ||
                    cls.contains("edxp")
            }
        }
    }

    /**
     * Scan /proc/self/maps for known hooking libraries (Xposed, LSPosed, Frida, etc.).
     */
    private fun isHookingLibInProcMaps(): Boolean {
        val indicators = listOf(
            "xposed",       // generic Xposed
            "lsposed",      // LSPosed
            "edxp",         // EdXposed
            "frida",        // Frida gadget/server
            "substrate",    // Substrate-like libs on Android
            "sandhook",     // SandHook
            "epic"          // Epic hooking
        )

        return try {
            val mapsFile = File("/proc/self/maps")
            if (!mapsFile.exists() || !mapsFile.canRead()) return false

            BufferedReader(FileReader(mapsFile)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    val l = line ?: continue
                    if (indicators.any { indicator ->
                            l.contains(indicator, ignoreCase = true)
                        }
                    ) {
                        return true
                    }
                }
            }
            false
        } catch (e: Exception) {
            Log.w("ShieldScan", "Failed to read /proc/self/maps for hook detection", e)
            false
        }
    }

    /**
     * Detects ADB-enabled + debuggable build combination,
     * which is a high-risk, hook-friendly environment.
     */
    private fun isAdbRootOrDebuggable(): Boolean {
        return try {
            val adbEnabled = Settings.Secure.getInt(
                reactContext.contentResolver,
                Settings.Secure.ADB_ENABLED, 0
            ) == 1

            val isDebuggable = (reactContext.applicationInfo.flags and
                android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0

            adbEnabled && isDebuggable
        } catch (_: Exception) {
            false
        }
    }
}
