import { Platform, Linking, Alert } from 'react-native';
import { updateSavedVersion } from '../store/appVersionSlice';
import { getMessages } from '../constants/Messages';

/**
 * Open download link for user to download new app
 * 
 * Android: Open browser to download APK file
 * iOS: Open Safari to install via manifest.plist
 * 
 * @param {Object} updateInfo - Update information
 * @param {string} updateInfo.downloadUrl - URL to download app
 * @param {string} updateInfo.newVersion - New version
 * @param {string} updateInfo.oldVersion - Current version
 * @param {Function} dispatch - Redux dispatch function
 */
export const openDownloadLink = async (updateInfo, dispatch) => {
  const { downloadUrl, newVersion } = updateInfo;
  const messages = getMessages();

  if (!downloadUrl) {
    Alert.alert(messages.error.generic, messages.update.downloadUrlNotFound);
    return;
  }

  try {
    
    // Show confirmation alert before opening browser
    const platformName = Platform.OS === 'android' ? 'Android' : 'iOS';

    Alert.alert(
      messages.update.updateAvailable,
      messages.update.versionInfo(newVersion, updateInfo.oldVersion),
      [
        {
          text: messages.update.cancel,
          style: 'cancel',
        },
        {
          text: messages.update.download,
          onPress: async () => {
            try {
              // Debug: Log URL before opening
              console.log('🔍 Attempting to open URL:', downloadUrl);
              console.log('🔍 Platform:', Platform.OS);
              
              // For iOS: Extract the actual plist URL from itms-services if needed
              let urlToOpen = downloadUrl;
              if (Platform.OS === 'ios' && downloadUrl.includes('itms-services://')) {
                // Extract the manifest URL from itms-services scheme
                const match = downloadUrl.match(/url=([^&]+)/);
                if (match) {
                  const manifestUrl = decodeURIComponent(match[1]);
                  console.log('🔍 Extracted manifest URL:', manifestUrl);
                  
                  // Option 1: Open Safari with the manifest URL directly
                  urlToOpen = manifestUrl;
                  
                  // Option 2: Keep itms-services for direct installation
                  // urlToOpen = downloadUrl;
                }
              }
              
              console.log('🔍 Final URL to open:', urlToOpen);
              
              // Check if URL can be opened first
              const canOpen = await Linking.canOpenURL(urlToOpen);
              console.log('🔍 Can open URL:', canOpen);
              
              if (!canOpen) {
                Alert.alert(
                  messages.error.generic,
                  messages.update.cannotOpenUrl(platformName, urlToOpen)
                );
                return;
              }
              
              // Open URL
              await Linking.openURL(urlToOpen);
              
              console.log(`✅ Opened ${platformName} download link:`, urlToOpen);
              
              // Save new version to prevent showing modal again
              await dispatch(updateSavedVersion(newVersion));
              console.log('✅ Saved new version:', newVersion, '(User confirmed download)');
            } catch (openError) {
              console.error('❌ Error opening URL:', openError);
              console.error('❌ Error details:', openError.message);
              Alert.alert(
                messages.error.generic,
                messages.update.errorOpeningUrl(downloadUrl, openError.message)
              );
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error('❌ Error in openDownloadLink:', error);
    Alert.alert(
      messages.error.generic,
      messages.update.unableToOpenLink
    );
  }
};

/**
 * Manually update saved version after user confirms installation
 * Call this after user successfully installs the new version
 * 
 * @param {string} newVersion - The new version to save
 * @param {Function} dispatch - Redux dispatch function
 */
export const confirmVersionUpdate = async (newVersion, dispatch) => {
  try {
    await dispatch(updateSavedVersion(newVersion));
    console.log('✅ Version updated successfully to:', newVersion);
  } catch (error) {
    console.error('❌ Error updating version:', error);
  }
};
