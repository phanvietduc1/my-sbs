
# SBS NDS Mobile App

## Table of Contents
- SBS NDS Mobile App
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Release for Android](#release-for-android)
    - [Unsigned (Debug) APK](#unsigned-debug-apk)
    - [Signed (Release) APK](#signed-release-apk)

## SBS NDS Mobile App

## Installation

### Prerequisites

- Install [Node.js](https://nodejs.org/)
- Install [React Native CLI](https://reactnative.dev/docs/environment-setup)
- Install Java Development Kit (JDK 17+) & configure `JAVA_HOME` environment variable
- Install Android Studio & configure `ANDROID_HOME` environment variable

- Install Xocde


1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Link required packages (for React Native < 0.60):**
   ```bash
   react-native link
   ```

3. **Run the app on iOS or Android:**

   For iOS:
   ```bash
   export REACT_NATIVE_HERMES_DOWNLOAD_DISABLED=true
   cd ios
   pod install
   cd..
   ```
   ```bash
   npx react-native run-ios
   ```

   For Android:
   ```bash
   npx react-native run-android
   ```

---
## Environment Variables 

```
WEBVIEW_URL=https://web.example.com
```
---

## Release for Android
### Signed (Release) APK
This version is required for production or publishing to the Google Play Store

Step 1: Generate Keystore
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore \
  -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
Place the my-release-key.keystore file in android/app/

Step 2: Configure gradle.properties

Edit or create android/gradle.properties:
```bash
MYAPP_UPLOAD_STORE_FILE=my-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=your_keystore_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```
Step 3: Update build.gradle

Edit android/app/build.gradle:
```bash
android {
    // ...existing config...
    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }

    buildTypes {
        release {
            // ...existing config...
            signingConfig signingConfigs.release
        }
    }
}
```
Step 4: Build the Signed APK
```bash
cd android
./gradlew assembleRelease
```
Locate APK:
```bash
android/app/build/outputs/apk/release/app-release.apk
```

---
## Build IOS for Release
## 1. Requirements

- **macOS** with Xcode (version ≥ 14.x) installed
- Valid **Apple Developer** account with Certificates and Provisioning Profiles (Ad Hoc or App Store)
- A working **React Native CLI** project
- Url must be https for ios 9.0
- CocoaPods dependencies installed:
  ```bash
  cd ios && pod install && cd ..
---

## 2. Archive and Export via Xcode GUI
> **Note:** Ensure you are signed in to Xcode with your active Apple Developer account. Go to **Xcode → Preferences → Accounts** and add your Apple ID before proceeding.
1. Open your project in Xcode:
   ```bash
   open ios/webEditApp.xcworkspace
   ```
2. Select your app Scheme and set the build configuration to Release.

3. From the menu, choose Product → Archive to create an archive.

4. Once the archive finishes, the Organizer window appears. Select your new archive.

5. Click Distribute App → choose Ad Hoc (for internal distribution) or App Store (for TestFlight/App Store) → Next.

6 .Confirm your Signing settings (Team & Provisioning Profile) → Next.

7 .Choose an output folder; Xcode will generate YourApp.ipa.
