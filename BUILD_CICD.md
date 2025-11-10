# Build Guide - IPA and APK

This guide explains how to build iOS IPA and Android APK/AAB files using GitHub Actions CI/CD workflows.

## Table of Contents

- [Prerequisites](#prerequisites)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Building via CI/CD](#building-via-cicd)
  - [Android Build](#android-build)
  - [iOS Build](#ios-build)

---

## Prerequisites

### For CI/CD Builds

- GitHub repository with Actions enabled
- GitHub Secrets configured (see [GitHub Secrets Configuration](#github-secrets-configuration))

---

## GitHub Secrets Configuration

Before building via CI/CD, you need to configure the following GitHub Secrets in your repository:

### Android Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

1. **ANDROID_KEYSTORE_BASE64**
   - Your keystore file (`.keystore` or `.jks` format) encoded in base64
   - To encode: `base64 -i android/app/my-release-key.keystore | pbcopy` (macOS) or `base64 android/app/my-release-key.keystore` (Linux)
   - **Note:** The workflow uses `.jks` extension, but both formats work. The decoded file will be saved as `my-release-key.jks`

2. **KEYSTORE_PASSWORD**
   - Password for your keystore file

3. **KEY_ALIAS**
   - Key alias name (e.g., `my-key-alias`)

4. **KEY_PASSWORD**
   - Password for your key alias

### iOS Secrets

1. **IOS_TEAM_ID**
   - Your Apple Developer Team ID (e.g., `LA2TGF2T65`)

### Optional Secrets

---

## Building via CI/CD

### Android Build

The Android build workflow automatically:
- Builds a signed Release APK
- Builds a signed Release AAB (Android App Bundle)
- Uploads both artifacts for download

#### Trigger Build

**Option 1: Push to `develop` branch**
```bash
git push origin develop
```

**Option 2: Create Pull Request to `develop` branch**
```bash
git checkout -b feature/your-feature
git push origin feature/your-feature
# Create PR to develop branch
```

**Option 3: Manual trigger**
1. Go to **Actions** tab in GitHub
2. Select **Build Android APK** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

#### Build Process

The workflow:
1. Checks out code
2. Sets up Node.js 18
3. Sets up Java JDK 17
4. Sets up Android SDK
5. Installs npm dependencies
7. Decodes keystore from GitHub Secrets
8. Creates `gradle.properties` with signing configuration
9. Builds APK and AAB
10. Uploads artifacts

#### Output Files

After build completes:
- Download from **Actions → [Workflow Run] → Artifacts**
- **app-release**: Contains `app-release.apk`
- **app-release-bundle**: Contains `app-release.aab`

---

### iOS Build

The iOS build workflow automatically:
- Builds a signed Release IPA
- Uses automatic code signing
- Uploads IPA artifact for download

#### Trigger Build

Same methods as Android:
- Push to `develop` branch
- Create PR to `develop` branch
- Manual trigger via Actions tab

#### Build Process

The workflow:
1. Checks out code
2. Sets up Node.js 18
3. Sets up Xcode (latest stable)
4. Installs npm dependencies
6. Installs CocoaPods dependencies
7. Creates export options plist
8. Archives the app using xcodebuild
9. Exports IPA
10. Uploads IPA artifact

#### Output Files

After build completes:
- Download from **Actions → [Workflow Run] → Artifacts**
- **webEditApp-ios**: Contains the IPA file

---

## Troubleshooting

### Android Build Issues

**Issue: Keystore not found**
- Ensure keystore file exists at `android/app/my-release-key.keystore`
- Check `MYAPP_RELEASE_STORE_FILE` path in `gradle.properties`

**Issue: Signing configuration error**
- Verify all signing properties are set in `gradle.properties`
- Ensure keystore passwords are correct

**Issue: Build fails on CI**
- Verify GitHub Secrets are correctly configured
- Check keystore base64 encoding is valid

### iOS Build Issues

**Issue: Code signing error**
- Verify Team ID is set in GitHub Secret `IOS_TEAM_ID`
- Check Xcode project has correct Team configured
- Ensure certificates and provisioning profiles are valid

**Issue: Pod install fails**
- Delete `ios/Pods` and `Podfile.lock`
- Run `pod install --repo-update`

**Issue: Archive fails**
- Ensure you have valid Apple Developer account
- Check provisioning profiles match bundle identifier
- Verify automatic signing is enabled

---

## Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [iOS Code Signing](https://developer.apple.com/documentation/xcode/managing-your-team-s-signing-assets)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
