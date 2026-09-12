package com.genzfeast.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * One-tap "exempt this app from battery optimization" prompt — added
 * because on MIUI (and similar OEM power management) this app can be
 * throttled to background moments after a user action, silently delaying
 * FCM delivery (specs/014-msg91-sms-otp-mobile-verification's push
 * fallback). Uses `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
 * targeted at this app specifically (via `setData`), not the generic
 * settings-list variant.
 *
 * Requires `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` in
 * AndroidManifest.xml — a Play-Store-restricted permission this app's
 * category (food ordering) does not clearly qualify for. That risk was
 * explained to and explicitly accepted by the project owner; see the
 * manifest's own comment on this permission.
 */
class BatteryOptimizationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return MODULE_NAME
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    val context = reactApplicationContext
    val packageName = context.packageName
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager

    if (powerManager == null || powerManager.isIgnoringBatteryOptimizations(packageName)) {
      promise.resolve(null)
      return
    }

    val activity = context.currentActivity
    if (activity == null) {
      // No foreground activity to launch the dialog from — nothing to do.
      promise.resolve(null)
      return
    }

    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:$packageName")
    }
    activity.startActivity(intent)
    promise.resolve(null)
  }

  companion object {
    const val MODULE_NAME = "BatteryOptimizationModule"
  }
}
