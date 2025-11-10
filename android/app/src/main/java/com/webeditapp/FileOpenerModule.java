package com.webeditapp;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

public class FileOpenerModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "FileOpenerModule";

    public FileOpenerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void openFile(String filePath, String mimeType, Promise promise) {
        try {
            File file = new File(filePath);
            
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            // Use FileProvider to create content:// URI for file
            Uri fileUri = FileProvider.getUriForFile(
                getReactApplicationContext(),
                getReactApplicationContext().getPackageName() + ".fileprovider",
                file
            );

            // Automatically detect MIME type if not provided
            if (mimeType == null || mimeType.isEmpty()) {
                String extension = getFileExtension(filePath);
                mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                if (mimeType == null) {
                    mimeType = "application/octet-stream";
                }
            }

            // Create Intent to open file
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(fileUri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Check if any app can open the file
            if (intent.resolveActivity(getReactApplicationContext().getPackageManager()) != null) {
                getReactApplicationContext().startActivity(intent);
                promise.resolve("File opened successfully");
            } else {
                // If no app can open it, try opening with chooser
                Intent chooserIntent = Intent.createChooser(intent, "Open file with");
                chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(chooserIntent);
                promise.resolve("File opened with chooser");
            }

        } catch (ActivityNotFoundException e) {
            promise.reject("NO_APP_FOUND", "No application found to open this file type");
        } catch (Exception e) {
            promise.reject("ERROR_OPENING_FILE", "Error opening file: " + e.getMessage());
        }
    }

    private String getFileExtension(String filePath) {
        int lastDot = filePath.lastIndexOf('.');
        if (lastDot > 0) {
            return filePath.substring(lastDot + 1).toLowerCase();
        }
        return "";
    }
}
