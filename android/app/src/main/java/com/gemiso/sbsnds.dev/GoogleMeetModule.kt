package com.gemiso.sbsnds.dev

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class GoogleMeetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "GoogleMeetModule"
    }
    
    @ReactMethod
    fun joinMeetingByPhone(phoneNumber: String, promise: Promise) {
        try {
            val cleanNumber = phoneNumber.replace(Regex("[^\\d+]"), "")
            
            // Create Google Meet URL with phone number
            val meetUrl = "https://meet.google.com/tel/$cleanNumber"
            
            // Try to open Google Meet app first
            val meetIntent = Intent(Intent.ACTION_VIEW, Uri.parse("googlemeet://tel/$cleanNumber"))
            meetIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            
            if (isGoogleMeetInstalled()) {
                reactApplicationContext.startActivity(meetIntent)
                promise.resolve("Google Meet app opened with phone number")
            } else {
                // Fallback to web version
                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(meetUrl))
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(webIntent)
                promise.resolve("Google Meet web opened with phone number")
            }
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to open Google Meet: ${e.message}")
        }
    }
    
   @ReactMethod
fun startInstantMeetingWithPhone(phoneNumber: String, promise: Promise) {
    try {
        // 1. Normalize to E.164 format
        val digits = phoneNumber.replace(Regex("[^\\d+]"), "")
        val e164 = if (digits.startsWith("0")) "+84${digits.drop(1)}" else digits

        // 2. Use Meet URI scheme
        val uri = Uri.parse("googlemeet://new?tel=${Uri.encode(e164)}")

        // 3. Create VIEW Intent, force package to Google Meet
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            `package` = "com.google.android.apps.meetings"
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        // 4. Try to launch
        if (intent.resolveActivity(reactApplicationContext.packageManager) != null) {
            reactApplicationContext.startActivity(intent)
            // Return result as before
            val result = Arguments.createMap()
            result.putString("meetingUrl", uri.toString())
            result.putString("phoneNumber", e164)
            promise.resolve(result)
        } else {
            // Fallback: if Meet is not installed, open web
            val webUrl = "https://meet.google.com/new?tel=${Uri.encode(e164)}"
            reactApplicationContext.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            promise.resolve(Arguments.createMap().apply {
                putString("meetingUrl", webUrl)
                putString("phoneNumber", e164)
            })
        }

    } catch (e: Exception) {
        promise.reject("ERROR", "Failed to start instant meeting: ${e.message}")
    }
}

    @ReactMethod
    fun openGoogleMeetWithDialer(promise: Promise) {
        try {
            // Open Google Meet with dialer interface
            val meetDialerUrl = "googlemeet://dial"
            val webDialerUrl = "https://meet.google.com/dial"
            
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(meetDialerUrl))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            
            if (isGoogleMeetInstalled()) {
                reactApplicationContext.startActivity(intent)
                promise.resolve("Google Meet dialer opened")
            } else {
                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(webDialerUrl))
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(webIntent)
                promise.resolve("Google Meet web dialer opened")
            }
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to open Google Meet dialer: ${e.message}")
        }
    }
    
    @ReactMethod
    fun checkGoogleMeetInstalled(promise: Promise) {
        try {
            val isInstalled = isGoogleMeetInstalled()
            promise.resolve(isInstalled)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check Google Meet installation: ${e.message}")
        }
    }
    
    private fun isGoogleMeetInstalled(): Boolean {
        return try {
            val packageManager = reactApplicationContext.packageManager
            packageManager.getPackageInfo("com.google.android.apps.meetings", 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
    
    @ReactMethod
    fun generateMeetingLink(phoneNumber: String, promise: Promise) {
        try {
            val cleanNumber = phoneNumber.replace(Regex("[^\\d+]"), "")
            
            // Create meeting link with phone invitation
            val meetingId = generateRandomMeetingId()
            val meetUrl = "https://meet.google.com/$meetingId"
            
            val result = Arguments.createMap()
            result.putString("meetingUrl", meetUrl)
            result.putString("meetingId", meetingId)
            result.putString("phoneNumber", cleanNumber)
            result.putString("inviteMessage", "Join me on Google Meet: $meetUrl or call $cleanNumber")
            
            promise.resolve(result)
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to generate meeting link: ${e.message}")
        }
    }
    
    private fun generateRandomMeetingId(): String {
        val chars = "abcdefghijklmnopqrstuvwxyz"
        val length = 10
        return (1..length)
            .map { chars.random() }
            .joinToString("")
            .chunked(3)
            .joinToString("-")
    }
}