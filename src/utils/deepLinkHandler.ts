import { Linking, Platform, Alert } from 'react-native';
import { getMessages } from '../constants/Messages';

/**
 * Deep Link Handler - Clean implementation for external app links
 * 
 * Currently supports:
 * - kakaomap://open - KakaoMap navigation
 * 
 * Add more schemes here as needed in the future
 */

let deepLinkFired = false; // Prevent double-trigger on Android

/**
 * Check if URL should be opened externally (outside WebView)
 */
export function shouldOpenExternally(url: string): boolean {
  return url.startsWith('kakaomap://');
}

/**
 * Open external app or redirect to store if app not installed
 * Can be called synchronously (fire-and-forget)
 */
export async function openExternalApp(url: string): Promise<void> {
  // Prevent double-trigger
  if (deepLinkFired) {
    console.log('⏭️  Deep link already fired, skipping...');
    return;
  }
  deepLinkFired = true;

  try {
    console.log('🔗 Attempting to open external app:', url);

    // Check if app can be opened
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
      console.log('✅ Opened external app successfully');
    } else {
      // App not installed - redirect to store
      console.log('📱 App not installed, opening store...');
      await openAppStore(url);
    }
  } catch (error) {
    console.error('❌ Error opening external app:', error);
    
    // Fallback to store
    try {
      await openAppStore(url);
    } catch (storeError) {
      console.error('❌ Error opening store:', storeError);
      const messages = getMessages();
      Alert.alert(
        messages.error.generic,
        'Unable to open the app. Please install it from the App Store / Play Store.'
      );
    }
  } finally {
    // Allow next trigger after 1 second
    setTimeout(() => {
      deepLinkFired = false;
    }, 1000);
  }
}

/**
 * Open appropriate app store based on platform and URL scheme
 */
async function openAppStore(url: string): Promise<void> {
  if (url.startsWith('kakaomap://')) {
    if (Platform.OS === 'android') {
      await Linking.openURL('market://details?id=net.daum.android.map');
    } else {
      await Linking.openURL('https://apps.apple.com/app/id304608425');
    }
  }
  // Add more app store URLs for different schemes here
}
