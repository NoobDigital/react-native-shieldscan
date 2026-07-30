package com.shieldscan

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.bridge.LifecycleEventListener
import com.scottyab.rootbeer.RootBeer
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.net.Socket
import java.util.function.Consumer
import android.widget.FrameLayout
import android.widget.TextView
import android.view.Gravity

class ShieldScanModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener,
    ActivityEventListener {  

    private var lastActivity: Activity? = null
    private var blurEnabled: Boolean = false
    private var screenshotPreventionEnabled: Boolean = false
    private var blurView: View? = null

    private var wrappedCallback: WindowCallbackWrapper? = null
    private var originalCallback: Window.Callback? = null

    private var screenRecordingCallback: Consumer<Int>? = null
    private var isCurrentlyRecording: Boolean = false

    init {
        reactContext.addLifecycleEventListener(this)
        reactContext.addActivityEventListener(this)
        lastActivity = reactContext.currentActivity
        lastActivity?.let { attachWindowCallback(it) }
    }

    override fun getName(): String = "ShieldScan"

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {}
    override fun onNewIntent(intent: Intent) {}

    private inner class WindowCallbackWrapper(private val base: Window.Callback) : Window.Callback by base {
        override fun onWindowFocusChanged(hasFocus: Boolean) {
            base.onWindowFocusChanged(hasFocus)
            val activity = lastActivity ?: return
            if (!hasFocus) {
                if (blurEnabled) applyBlurOverlay(activity)
            } else {
                removeBlurOverlay(activity)
            }
        }
    }

   private fun attachWindowCallback(activity: Activity) {
        val window = activity.window ?: return
        val current = window.callback
        if (current !is WindowCallbackWrapper) {
            originalCallback = current
            val wrapper = WindowCallbackWrapper(current)
            window.callback = wrapper
            wrappedCallback = wrapper
        }
        registerScreenRecordingDetection(activity)
    }
    private fun detachWindowCallback(activity: Activity) {
        unregisterScreenRecordingDetection(activity)
        val window = activity.window ?: return
        if (window.callback is WindowCallbackWrapper) {
            originalCallback?.let { window.callback = it }
        }
        wrappedCallback = null
        originalCallback = null
    }

    private fun registerScreenRecordingDetection(activity: Activity) {
        if (Build.VERSION.SDK_INT < 35) return

        val hasPermission = activity.checkSelfPermission(
            "android.permission.DETECT_SCREEN_RECORDING"
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) return

        val wm = activity.getSystemService(Activity.WINDOW_SERVICE) as? WindowManager ?: return

        val callback = Consumer<Int> { state ->
            isCurrentlyRecording = (state == 1)
        }

        try {
            val method = WindowManager::class.java.getMethod(
                "addScreenRecordingCallback",
                java.util.concurrent.Executor::class.java,
                Consumer::class.java
            )
            val initialState = method.invoke(wm, activity.mainExecutor, callback) as Int
            isCurrentlyRecording = (initialState == 1)
            screenRecordingCallback = callback
        } catch (_: Exception) {
            isCurrentlyRecording = false
        }
    }

    private fun unregisterScreenRecordingDetection(activity: Activity) {
        if (Build.VERSION.SDK_INT < 35) return
        val wm = activity.getSystemService(Activity.WINDOW_SERVICE) as? WindowManager ?: return
        val callback = screenRecordingCallback ?: return

        try {
            val method = WindowManager::class.java.getMethod(
                "removeScreenRecordingCallback",
                Consumer::class.java
            )
            method.invoke(wm, callback)
        } catch (_: Exception) {
        }
        screenRecordingCallback = null
    }

    @ReactMethod
    fun isScreenBeingRecorded(promise: Promise) {
        if (Build.VERSION.SDK_INT < 35) {
            promise.resolve(false)
            return
        }
        promise.resolve(isCurrentlyRecording)
    }

    override fun onHostPause() {
        if (blurEnabled) lastActivity?.let { applyBlurOverlay(it) }
    }

    override fun onHostResume() {
        val activity = reactContext.currentActivity
        if (activity != null && activity !== lastActivity) {
            lastActivity?.let { detachWindowCallback(it) }
            lastActivity = activity
            attachWindowCallback(activity)
        } else if (lastActivity == null) {
            lastActivity = activity
            activity?.let { attachWindowCallback(it) }
        }
        lastActivity?.let { removeBlurOverlay(it) }
    }

    override fun onHostDestroy() {
        lastActivity?.let {
            removeBlurOverlay(it)
            detachWindowCallback(it)
        }
        lastActivity = null
    }

    @ReactMethod
    fun setBlurEnabled(enabled: Boolean, promise: Promise) {
        blurEnabled = enabled
        val activity = lastActivity
        if (!enabled && activity != null) {
            activity.runOnUiThread {
                removeBlurOverlay(activity)
            }
        }
        promise.resolve(enabled)
    }

    @ReactMethod
    fun setScreenshotPreventionEnabled(enabled: Boolean, promise: Promise) {
        screenshotPreventionEnabled = enabled
        val activity = lastActivity
        if (activity != null) {
            activity.runOnUiThread {
                applyFlagSecure(activity, enabled)
            }
        }
        promise.resolve(enabled)
    }

    private fun applyFlagSecure(activity: Activity, enabled: Boolean) {
        if (enabled) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    private fun applyBlurOverlay(activity: Activity) {
        removeBlurOverlay(activity)

        val rootView = activity.window.decorView as? ViewGroup ?: return

        val overlay = FrameLayout(activity)
        overlay.setBackgroundColor(0xFFFFFFFF.toInt())

        val textView = TextView(activity)
        textView.text = "We’re protecting your sensitive content."
        textView.textSize = 17f
        textView.setTextColor(0xFF000000.toInt())
        textView.gravity = Gravity.CENTER

        overlay.addView(
            textView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        rootView.addView(
            overlay,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        val widthSpec = View.MeasureSpec.makeMeasureSpec(rootView.width, View.MeasureSpec.EXACTLY)
        val heightSpec = View.MeasureSpec.makeMeasureSpec(rootView.height, View.MeasureSpec.EXACTLY)
        overlay.measure(widthSpec, heightSpec)
        overlay.layout(0, 0, rootView.width, rootView.height)
        overlay.invalidate()

        blurView = overlay
    }

    private fun removeBlurOverlay(activity: Activity) {
        val rootView = activity.window.decorView as? ViewGroup ?: return
        blurView?.let { rootView.removeView(it) }
        blurView = null
    }

    @ReactMethod
    fun runSecurityChecks(promise: Promise) {
        try {
            promise.resolve(buildSecurityCheckMap())
        } catch (e: Exception) {
            promise.reject("SHIELD_SCAN_ERROR", e.message, e)
        }
    }

    fun runSecurityChecks(): WritableMap = buildSecurityCheckMap()

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

    private fun isRooted(): Boolean {
        return try {
            RootBeer(reactContext).isRooted
        } catch (e: Exception) {
            false
        }
    }

    private fun hasSuspiciousFiles(): Boolean {
        val suspiciousPaths = listOf(
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/system/bin/.ext/.su",
            "/system/xbin/daemonsu",
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk",
            "/system/etc/init.d/99SuperSUDaemon",
            "/system/usr/we-need-root/",
            "/system/app/Kinguser.apk",
            "/magisk",
            "/data/adb/magisk",
            "/data/adb/magisk.db",
            "/sbin/.magisk",
            "/cache/.disable_magisk",
            "/system/framework/XposedBridge.jar",
            "/data/local/tmp/frida",
            "/data/local/tmp/re.frida.server",
        )

        return suspiciousPaths.any { File(it).exists() }
    }

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

    private fun isEmulator(): Boolean {
        val fp = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val manufacturer = Build.MANUFACTURER.lowercase()
        val brand = Build.BRAND.lowercase()
        val device = Build.DEVICE.lowercase()
        val product = Build.PRODUCT.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        val host = Build.HOST.lowercase()

        if (fp.contains("generic") ||
            fp.contains("unknown") ||
            fp.contains("vbox")
        ) return true

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

        if (manufacturer.contains("genymotion") ||
            manufacturer.contains("bluestacks") ||
            manufacturer.contains("nox") ||
            manufacturer.contains("mumu") ||
            manufacturer.contains("virtualbox")
        ) return true

        val productIndicators = listOf(
            "sdk", "sdk_x86", "sdk_google",
            "vbox86p", "emulator", "android_x86",
            "sdk_gphone", "sdk_gphone64"
        )
        if (productIndicators.any { product.contains(it) }) return true

        val hardwareIndicators = listOf("goldfish", "ranchu", "qemu", "vbox86")
        if (hardwareIndicators.any { hardware.contains(it) }) return true

        val emulatorFiles = listOf(
            "/dev/socket/qemud",
            "/dev/qemu_pipe",
            "/system/lib/libc_malloc_debug_qemu.so",
            "/system/bin/qemu-props"
        )
        if (emulatorFiles.any { File(it).exists() }) return true

        if (host.contains("qemu") || host.contains("buildbot")) return true

        return false
    }

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
    @Suppress("DEPRECATION")
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

        return devOptions || adbEnabled
    }
}
