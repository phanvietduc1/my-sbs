package com.webeditapp

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class FileOpenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "FileOpenerModule"
        private const val ERROR_FILE_NOT_FOUND = "FILE_NOT_FOUND"
        private const val ERROR_NO_APP_FOUND = "NO_APP_FOUND"
        private const val ERROR_OPENING_FOLDER = "ERROR_OPENING_FOLDER"
    }

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun openDownloadsFolder(promise: Promise) {
        try {
            // DownloadManager viewer
            val intent1 = Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            try {
                reactApplicationContext.startActivity(intent1)
                promise.resolve("Opened Downloads folder")
                return
            } catch (e: ActivityNotFoundException) {
                // Continue to fallback
            }
            
            // URI Downloads (encoded)
            val intent2 = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload"),
                    "vnd.android.document/directory"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            try {
                reactApplicationContext.startActivity(intent2)
                promise.resolve("Opened Downloads in file manager")
                return
            } catch (e: ActivityNotFoundException) {
                // Continue to fallback
            }
            
            // DocumentsContract (Android 10+)
            val intent3 = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    Uri.parse("content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload"),
                    "vnd.android.document/directory"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            try {
                reactApplicationContext.startActivity(intent3)
                promise.resolve("Opened Downloads folder")
                return
            } catch (e: ActivityNotFoundException) {
                // Continue to fallback
            }
            
            // 4: Root folder
            val intent4 = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    Uri.parse("content://com.android.externalstorage.documents/root/primary"),
                    "vnd.android.document/directory"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            try {
                reactApplicationContext.startActivity(intent4)
                promise.resolve("Opened file manager (root)")
                return
            } catch (e: ActivityNotFoundException) {
                promise.reject("ERROR_OPENING_FOLDER", "No file manager app found")
            }
            
        } catch (e: Exception) {
            promise.reject("ERROR_OPENING_FOLDER", e.message ?: "Unknown error")
        }
    }
} 