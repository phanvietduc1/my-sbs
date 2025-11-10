# iOS Release Build Guide

> **Before proceeding with the steps below, make sure you have installed the required libraries by running:**
>
> ```bash
> cd ios
> pod install
> ```
>
> *If you haven't installed CocoaPods yet, run `sudo gem install cocoapods` first.*

## 1. Generate a Certificate Signing Request (CSR)

1. Open **Keychain Access** on macOS.  
2. Go to **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…**  
3. Fill in the following fields:  
   - **User Email Address**: your or your team’s email address  
   - **Common Name**: an identifiable name (e.g., Company iOS Build Mac)  
   - **CA Email Address**: *leave this field blank*  
4. Choose **Saved to disk** and click **Continue** → this will generate a `.certSigningRequest` (CSR) file and store the **private key** in your Keychain (under *login*).  
5. *(Recommended)* Once Apple issues your certificate, **export the private key and certificate** as a `.p12` file for backup or CI/CD usage:  
   - In **Keychain Access**, locate the corresponding private key  
   - Right-click → **Export** → choose **.p12** format and set a strong password.


## 2. Generate iOS Certificate in Apple Developer

1. Log in to [Apple Developer Certificates page](https://developer.apple.com/account/resources/certificates/list).  
2. Click the **+** button to create a new certificate.  
3. Choose the correct certificate type:
   - **Apple Distribution** → for App Store, Ad Hoc, or Enterprise builds  
4. Upload the `.certSigningRequest` (CSR) file you generated earlier from **Keychain Access**.  
5. Download the issued certificate file (`.cer`).  
6. Double-click the `.cer` file to install it into **Keychain Access**.  
   - Make sure the certificate appears **paired with its private key** (a small arrow can be expanded to show the private key below it).  
   - If no private key appears, you must use the same Mac and Keychain where the CSR was originally generated.
 

## 3. Create an App ID

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).  
2. Click the **+** button to create a new identifier.  
3. Choose **App IDs → App** and click **Continue**.  
4. Enter the following details:
   - **Description**: a name to identify your app (e.g., Company App)
   - **Bundle ID (Explicit)**: must exactly match your app’s bundle identifier (e.g., `com.company.app`)  
     > Use the **explicit** Bundle ID option — *wildcard IDs* (e.g., `com.company.*`) cannot be used for push notifications or many services.
5. Under **Capabilities**, enable any services your app uses (e.g., Push Notifications, Sign In with Apple, Background Modes, etc.).  
6. Click **Continue**, then **Register** to save the new App ID.


## 4. Create a Provisioning Profile

1. Go to [Apple Developer Profiles](https://developer.apple.com/account/resources/profiles/list).  
2. Click **+** to add a new provisioning profile.  
3. Select **Ad Hoc** (for testing distribution to registered devices).  
4. Choose the **App ID** you created.  
5. Select the certificate you installed earlier.  
6. Select the registered devices you want to allow.  
7. Name the profile and generate it.  
8. Download the `.mobileprovision` file.  
9. Double-click the `.mobileprovision` file to install it in Xcode, or drag it into the **Xcode → Devices and Simulators → Profiles** section. 

## 5. Configure Xcode for Release Build

1. Open your project in **Xcode Workspace** (`.xcworkspace`).  
2. Select your project in the left sidebar → **TARGETS → YourApp**.  
3. Go to **Signing & Capabilities** tab.  
4. For **Release configuration**:  
   - Uncheck **Automatically manage signing**.  
   - Select your **Team**.  
   - Choose the downloaded **Provisioning Profile**.  

## 6. Archive the App

1. In Xcode, select **Product → Archive**.  
2. Wait for Xcode to build and generate the archive.  
3. The Organizer window will open automatically with your build.  

## 7. Export IPA for Testing

1. In Organizer, select your archive and click **Distribute App**.  
2. Choose **Release Testing** (for testing)
3. Confirm the signing with your provisioning profile and certificate.  
4. Export the `.ipa` file.  
