# In-App Update System

## 📋 Overview

Automatic app version checking and update system, similar to other iOS/Android apps from the client:

1. **Check version** from JSON manifest on server
2. **Show popup** notification when new update is available
3. **Download** installation file (APK/IPA)
4. **Trigger install** automatically

## 🎯 Operation Flow

```
┌──────────────────────────────────────────────────────────┐
│  1. App starts / User returns to foreground              │
│     ↓                                                    │
│  2. Fetch manifest JSON                                  │
│     GET https://nrsm.sbs.co.kr/mobile/applist.json      │
│     Response: { nrsm_and: { version: "1.4", ... } }     │
│     ↓                                                    │
│  3. Compare versions                                     │
│     Current (package.json): "1.3"                        │
│     Server (manifest):      "1.4"                        │
│     Result: Update available! ✅                         │
│     ↓                                                    │
│  4. Show Update Popup                                    │
│     "🎉 Update Available"                               │
│     "Version 1.4 is now available"                      │
│     [Later] [Update Now]                                │
│     ↓                                                    │
│  5. User clicks "Update Now"                            │
│     ↓                                                    │
│  6. Download installation file                           │
│     URL: https://nrsm.sbs.co.kr/mobile/app/nrsM.apk     │
│     Progress: 0% → 100%                                 │
│     Save to: /storage/Download/nrsM.apk                 │
│     ↓                                                    │
│  7. Install                                              │
│     Android: Open APK file to install                    │
│     iOS: Open link TestFlight/Safari to download       │
│     ↓                                                    │
│  8. User installs new version                            │
│     ✅ Updated!                                          │
└──────────────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Redux Store (`appVersionSlice.js`)

**State:**
```javascript
{
  data: null,                    // Manifest data from server
  updateAvailable: false,        // Whether update is available
  updateInfo: {                  // Update information
    version: "1.4",
    filename: "nrsM.apk",
    path: "/mobile/app/",
    fullUrl: "https://...",
    platform: "android"
  },
  downloadProgress: 0,           // 0-100
  isDownloading: false,
  downloadError: null,
}
```

**Actions:**
```javascript
fetchAppVersion()        // Fetch manifest and check version
dismissUpdate()          // Dismiss popup (user selects "Later")
startDownload()          // Start download
setDownloadProgress(%)   // Update progress
downloadSuccess()        // Download complete
downloadFailed(error)    // Download failed
```

**Selectors:**
```javascript
selectUpdateAvailable()   // boolean
selectUpdateInfo()        // { version, filename, fullUrl, ... }
selectIsDownloading()     // boolean
selectDownloadProgress()  // 0-100
```

### 2. Update Modal (`UpdateModal.js`)

**Features:**
- ✅ Automatically shows when `updateAvailable = true`
- ✅ Displays new version
- ✅ Progress bar during download
- ✅ Buttons: "Later" and "Update Now"
- ✅ Disable buttons while downloading

**Props:** No props needed, automatically gets data from Redux

### 3. Update Manager (`UpdateManager.js`)

**Functions:**
```javascript
downloadAndInstallUpdate(updateInfo, dispatch)
  // Download file and trigger install
  // Android: Download APK → Install
  // iOS: Open link in browser/TestFlight

getFileSize(url)
  // Get file size (optional, to display in UI)
```

### 4. Version Checker Hook (`useVersionChecker.js`)

**Usage:**
```javascript
useVersionChecker({
  checkOnMount: true,          // Check when mounted
  checkOnForeground: true,     // Check when foreground
  checkInterval: 30 * 60 * 1000, // Periodic check (ms)
});
```

## 🚀 Integration Guide

### Step 1: Install additional packages

```bash
npm install react-native-device-info
# or
yarn add react-native-device-info

# Rebuild app
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

### Step 2: Update version in `package.json`

```json
{
  "name": "sbs-nds-mobile-app",
  "version": "1.3.0",  // ← Current app version
  ...
}
```

### Step 3: Integrate into App.tsx

```javascript
import React from 'react';
import { Provider } from 'react-redux';
import store from './src/store/store';
import UpdateModal from './src/components/UpdateModal';
import useVersionChecker from './src/hooks/useVersionChecker';
import TabNavigator from './src/App'; // Your existing app

const AppWithUpdate = () => {
  // ✨ Auto check version
  useVersionChecker({
    checkOnMount: true,
    checkOnForeground: true,
    checkInterval: 30 * 60 * 1000, // 30 minutes
  });

  return (
    <>
      <TabNavigator />
      <UpdateModal />  {/* ← Add this line */}
    </>
  );
};

const App = () => (
  <Provider store={store}>
    <AppWithUpdate />
  </Provider>
);

export default App;
```

### Step 4: Test

1. **Test with old version:**
   - Set `package.json` version: `"1.3.0"`
   - Server manifest version: `"1.4"`
   - Result: Popup appears ✅

2. **Test with same version:**
   - Set `package.json` version: `"1.4.0"`
   - Server manifest version: `"1.4"`
   - Result: Popup does not appear ✅

## 📊 Manifest JSON Format

**Endpoint:** `https://nrsm.sbs.co.kr/mobile/applist.json`

```json
{
  "nrsm_and": {
    "version": "1.4",
    "filename": "nrsM.apk",
    "path": "/mobile/app/",
    "duration": 192,
    "durationVip": 720,
    "durationVipMember": "S921060,S910998,..."
  },
  "nrsm_ios": {
    "version": "1.7",
    "filename": "nrsM.plist",
    "path": "/mobile/app/",
    "duration": 192,
    "durationVip": 720,
    "durationVipMember": "S921060,S910998,..."
  },
  "nrsm_obt_and": { ... },
  "nrsm_obt_ios": { ... }
}
```

**Download URL is built automatically:**
```
https://nrsm.sbs.co.kr + path + filename
= https://nrsm.sbs.co.kr/mobile/app/nrsM.apk
```

## 🔍 Version Comparison Logic

```javascript
compareVersions("1.3.0", "1.4.0")  → true  (update available)
compareVersions("1.4.0", "1.4.0")  → false (same version)
compareVersions("1.5.0", "1.4.0")  → false (current newer)

// Semantic versioning: major.minor.patch
"1.4.0" → [1, 4, 0]
"1.3.9" → [1, 3, 9]
Compare: 1=1, 4>3 → Update available
```

## 🎯 Use Cases

### 1. Auto check on app start (recommended)

```javascript
useVersionChecker({ checkOnMount: true });
```

### 2. Periodic check every 1 hour

```javascript
useVersionChecker({ 
  checkInterval: 60 * 60 * 1000 
});
```

### 3. Check on foreground only

```javascript
useVersionChecker({ 
  checkOnMount: false,
  checkOnForeground: true 
});
```

### 4. Manual check button

```javascript
import { useDispatch } from 'react-redux';
import { fetchAppVersion } from './store/appVersionSlice';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  
  return (
    <Button 
      title="Check for Updates"
      onPress={() => dispatch(fetchAppVersion())}
    />
  );
};
```

## 🐛 Debugging

### Check logs:

```bash
# Android
adb logcat | grep -i "version\|update\|download"

# React Native logs
📱 Current app version: 1.3.0
☁️  Server version: 1.4
🎉 Update available!
📥 Starting download: https://...
📊 Download progress: 50.00%
✅ Download completed
📦 Installing APK
```

### Manual test:

```javascript
// In component
import { useDispatch } from 'react-redux';
import { fetchAppVersion } from './store/appVersionSlice';

const dispatch = useDispatch();

// Force check version
dispatch(fetchAppVersion());
```

### Check Redux state:

```javascript
import { useSelector } from 'react-redux';

const updateAvailable = useSelector(selectUpdateAvailable);
const updateInfo = useSelector(selectUpdateInfo);

console.log('Update available:', updateAvailable);
console.log('Update info:', updateInfo);
```

## ⚙️ Configuration

### Change check interval:

```javascript
// 5 minutes (for dev/testing)
checkInterval: 5 * 60 * 1000

// 30 minutes (recommended)
checkInterval: 30 * 60 * 1000

// 1 hour (for production)
checkInterval: 60 * 60 * 1000

// Disable periodic check
checkInterval: 0
```

### Custom manifest URL:

```javascript
// In appVersionSlice.js
const MANIFEST_URL = __DEV__ 
  ? 'https://dev-api.example.com/applist.json'  // Dev
  : 'https://nrsm.sbs.co.kr/mobile/applist.json'; // Prod

export const fetchAppVersion = createAsyncThunk(
  'appVersion/fetch',
  async () => {
    const response = await fetch(MANIFEST_URL);
    ...
  }
);
```

## 📱 Platform-specific

### Android:

- ✅ Download APK to `/storage/Download/`
- ✅ Auto request storage permission
- ✅ Trigger APK install via `Linking.openURL()`
- ✅ Progress bar displayed in popup
- ⚠️ User needs to enable "Install from unknown sources"

### iOS:

- ✅ Open link in Safari/TestFlight
- ❌ Cannot download/install directly (iOS restriction)
- 💡 Usually uses TestFlight or Enterprise distribution
- 💡 Manifest link (.plist) for OTA install

## 🔒 Security

### Recommendations:

1. ✅ **HTTPS only** for manifest and download URL
2. ✅ **Verify file** after download (checksum/hash)
3. ✅ **Code signing** for APK/IPA
4. ⚠️ **User confirmation** before install

### Optional: Verify file integrity

```javascript
import { getFileChecksum } from 'react-native-fs';

// After download
const checksum = await getFileChecksum(filePath, 'SHA256');
if (checksum !== expectedChecksum) {
  throw new Error('File corrupted');
}
```

## 📝 Best Practices

1. ✅ **Semantic versioning**: Use `major.minor.patch`
2. ✅ **Check on app start**: Always check on startup
3. ✅ **Silent update**: Don't disturb user too much
4. ✅ **Progress feedback**: Show progress bar during download
5. ✅ **Error handling**: Handle network errors, disk full, etc.
6. ✅ **Retry mechanism**: Allow retry if download fails
7. ⚠️ **Don't force update**: Allow "Later" option
8. ⚠️ **Test thoroughly**: Test on multiple devices/OS versions

## 🧪 Testing Checklist

- [ ] Newer version → Popup appears
- [ ] Same version → Popup does not appear
- [ ] Older version → Popup does not appear
- [ ] Click "Later" → Popup closes, can be reopened
- [ ] Click "Update Now" → Download starts
- [ ] Progress bar works
- [ ] Download complete → Install triggered
- [ ] Network error → Error message
- [ ] Foreground check works
- [ ] Periodic check works
- [ ] Android install APK succeeds
- [ ] iOS opens link successfully

## 📚 Files Created

```
src/
├── store/
│   └── appVersionSlice.js          # Redux store
├── components/
│   └── UpdateModal.js               # Update popup
├── utils/
│   └── UpdateManager.js             # Download & install logic
├── hooks/
│   └── useVersionChecker.js         # Auto check hook
└── examples/
    └── AppWithUpdate.example.js     # Integration example
```

## 🎉 Summary

Automatic update system:
- ✅ Check version from JSON manifest
- ✅ Compare with current version
- ✅ Show popup when update is available
- ✅ Download installation file with progress
- ✅ Trigger install automatically
- ✅ Support both Android and iOS
- ✅ Configurable (intervals, triggers)
- ✅ User-friendly (Later option)

**Result**: Users are always notified and update to the latest app version!

## 📞 Support

If you encounter issues:
1. Check logs (adb logcat / Metro logs)
2. Verify manifest URL is accessible
3. Check file permissions (Android)
4. Test version comparison logic
5. Verify download URL is valid
