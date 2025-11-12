package com.webeditapp

import android.content.ContentValues
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException

class DownloadModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName() = "DownloadModule"

    @ReactMethod
    fun saveToDownloads(base64Data: String, filename: String, mimeType: String?, promise: Promise) {
        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            
            val uniqueFilename = getUniqueFilename(filename)
            
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, uniqueFilename)
                put(MediaStore.Downloads.MIME_TYPE, mimeType ?: "application/octet-stream")
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw Exception("Failed to create file in Downloads")
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
            promise.resolve(uri.toString())
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message)
        }
    }
    
    private fun getUniqueFilename(filename: String): String {
        val resolver = context.contentResolver
        val projection = arrayOf(MediaStore.Downloads.DISPLAY_NAME)
        
        // file name and extension
        val lastDotIndex = filename.lastIndexOf('.')
        val name = if (lastDotIndex > -1) filename.substring(0, lastDotIndex) else filename
        val ext = if (lastDotIndex > -1) filename.substring(lastDotIndex) else ""
        
        var uniqueName = filename
        var counter = 1
        
        while (fileExistsInDownloads(uniqueName, resolver, projection)) {
            uniqueName = "$name($counter)$ext"
            counter++
        }
        
        return uniqueName
    }
    
    private fun fileExistsInDownloads(filename: String, resolver: android.content.ContentResolver, projection: Array<String>): Boolean {
        val selection = "${MediaStore.Downloads.DISPLAY_NAME} = ?"
        val selectionArgs = arrayOf(filename)
        
        resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            null
        )?.use { cursor ->
            return cursor.count > 0
        }
        
        return false
    }
}