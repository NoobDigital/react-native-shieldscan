package com.shieldscan

import android.os.Build
import android.os.Debug
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.turbomodule.core.interfaces.TurboModule
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
    ReactContextBaseJavaModule(reactContext),
    TurboModule {

    override fun getName(): String = "ShieldScan"

    // Bridge method (Old Architecture)
    @ReactMethod
    fun runSecurityChecks(promise: Promise) {
        try {
            promise.resolve(buildSecurityCheckMap())
        } catch (e: Exception) {
            promise.reject("SHIELD_SCAN_ERROR", e.message, e)
        }
    }

    // TurboModule method (New Architecture) — automatically bridged if available
    fun runSecurityChecks(): WritableMap = buildSecurityCheckMap()

    // Shared implementation
    private fun buildSecurityCheckMap(): WritableMap {
        val map = Arguments.createMap()
        val isEmulatorDevice = isEmulator()

        try {
            map.apply {
                putBoolean("rooted", isRooted())
                putBoolean("fileBasedRoot", hasSuspiciousFiles())
                putBoolean("fridaDetected", isFridaDetected())
                putBoolean("emulator", isEmulatorDevice)
                putBoolean("debugger", Debug.isDebuggerConnected())
                putBoolean("developerMode", isDeveloperOptionsEnabled())
                putBoolean("hooksDetected", if (isEmulatorDevice) false else isHookingFrameworkPresent())
            }
        } catch (e: Exception) {
            map.putString("error", e.message ?: "Unknown error")
        }

        return map
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
        val fp = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val manufacturer = Build.MANUFACTURER.lowercase()
        val brand = Build.BRAND.lowercase()
        val device = Build.DEVICE.lowercase()
        val product = Build.PRODUCT.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        val host = Build.HOST.lowercase()

        // Strong indicators (safe)
        if (fp.contains("generic") ||
            fp.contains("unknown") ||
            fp.contains("test-keys") ||
            fp.contains("vbox")
        ) return true

        // Modern Google emulator models
        val modelIndicators = listOf(
            "google_sdk",
            "emulator",
            "android sdk built for x86",
            "sdk_gphone",
            "sdk_gphone64",
            "sdk_gphone_x86_64",
            "sdk_gphone64_x86_64",
            "sdk_gphone64_arm64"
        )
        if (modelIndicators.any { model.contains(it) }) return true

        // Emulator manufacturers
        if (manufacturer.contains("genymotion") ||
            manufacturer.contains("bluestacks") ||
            manufacturer.contains("nox") ||
            manufacturer.contains("mumu") ||
            manufacturer.contains("virtualbox")
        ) return true

        // Emulator products
        val productIndicators = listOf(
            "sdk", "sdk_x86", "sdk_google",
            "vbox86p", "emulator", "android_x86",
            "sdk_gphone", "sdk_gphone64"
        )
        if (productIndicators.any { product.contains(it) }) return true

        // Emulator hardware
        val hardwareIndicators = listOf("goldfish", "ranchu", "qemu", "vbox86")
        if (hardwareIndicators.any { hardware.contains(it) }) return true

        // QEMU pipes
        val emulatorFiles = listOf(
            "/dev/socket/qemud",
            "/dev/qemu_pipe",
            "/system/lib/libc_malloc_debug_qemu.so",
            "/system/bin/qemu-props"
        )
        if (emulatorFiles.any { File(it).exists() }) return true

        // Host indicators
        if (host.contains("qemu") || host.contains("buildbot")) return true

        return false
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
        return hasHookingManagerInstalled()
            || isXposedActiveByStackTrace()
            || isHookingLibInProcMaps()
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
            throw Exception("ShieldScan stack probe")
        } catch (e: Exception) {
            e.stackTrace.any { element ->
                val cls = element.className

                cls.startsWith("de.robv.android.xposed.") ||
                cls.startsWith("org.lsposed.lspd.") ||
                cls.startsWith("com.lsposed.lspd.") ||
                cls == "edxp.XposedBridge" ||
                cls == "edxp.HookBridge" ||
                cls.contains(".xposed.XposedBridge")
            }
        }
    }


    private fun hasHookingManagerInstalled(): Boolean {
    val hookingPackages = listOf(
        "de.robv.android.xposed.installer",
        "com.solohsu.android.edxp.manager",
        "org.meowcat.edxposed.manager",
        "org.lsposed.manager",
        "com.lsposed.manager",
        "io.github.lsposed.manager"
    )
    return hookingPackages.any { hasPackage(it) }
    }

    private fun scanProcMaps(indicators: List<String>): Boolean {
        val mapsFile = File("/proc/self/maps")
        if (!mapsFile.exists() || !mapsFile.canRead()) return false

        return try {
            BufferedReader(FileReader(mapsFile)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    val path = line?.substringAfterLast(" ")?.trim() ?: continue
                    if (path.isNotEmpty() && indicators.any { path.contains(it, ignoreCase = true) }) {
                        return true
                    }
                }
            }
            false
        } catch (_: Exception) {
            false
        }
    }



    /**
     * Scan /proc/self/maps for known hooking libraries (Xposed, LSPosed, Frida, etc.).
     */
    private fun isHookingLibInProcMaps(): Boolean {
            val artifacts = listOf(
                "XposedBridge",
                "xposed_art",
                "lsposed",
                "edxp",
                "frida-agent",
                "frida-agent-32",
                "frida-agent-64",
                "frida-gadget",
                "libfrida-gadget",
                "sandhook",
                "libsubstrate",
                "/epic/"
            )
            return scanProcMaps(artifacts)
        }

    private fun isDeveloperOptionsEnabled(): Boolean {
        val devOptions = try {
            Settings.Secure.getInt(
                reactContext.contentResolver,
                Settings.Secure.DEVELOPMENT_SETTINGS_ENABLED, 0
            ) == 1
        } catch (_: Exception) {
            false
        }

        val adbEnabled = try {
            Settings.Secure.getInt(
                reactContext.contentResolver,
                Settings.Secure.ADB_ENABLED, 0
            ) == 1
        } catch (_: Exception) {
            false
        }

        // ADB implies developer options
        return devOptions || adbEnabled
    }


}
