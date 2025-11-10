import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { openExternalApp } from './utils/deepLinkHandler';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PermissionsAndroid, Platform, BackHandler } from 'react-native';
import Config from 'react-native-config';
import EventBridge from './brigde/eventBrigde';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS, { ReadDirItem } from 'react-native-fs';
import { ensureBiometricAuth, getDefaultBiometricConfig } from './utils/biometrics';
import { saveRefreshToken, getRefreshToken } from './utils/secureToken';
import { useFocusEffect } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationManager } from './utils/NotificationManager';
import { openFile } from './utils/FileOpener';
import { getMessages } from './constants/Messages';

const { GoogleMeetModule } = NativeModules;

const STORE_PREFIXES = [
  'https://play.google.com/',
  'https://play.app.goo.gl/',      
  'https://apps.apple.com/',
  'https://itunes.apple.com/',
  'https://global.app.mi.com/',    // Xiaomi GetApps
  'https://app.mi.com/',
  'https://galaxystore.samsung.com/',
  'https://apps.samsung.com/',
  'https://appgallery.huawei.com/'
];

// Foreground notification tap handler will be registered inside the component
// Add iOS safety check for GoogleMeetModule
const isGoogleMeetAvailable = Platform.OS === 'android' && GoogleMeetModule;


// Helper function to check and request permission dynamically
const requestPermissionDynamic = async (
  permission: any,
  title: string,
  message: string
): Promise<boolean> => {
  try {
    const result = await check(permission);

    if (result === RESULTS.GRANTED) {
      return true;
    }

    if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      return requestResult === RESULTS.GRANTED;
    }

    if (result === RESULTS.BLOCKED || result === RESULTS.UNAVAILABLE) {
      const messages = getMessages();
      Alert.alert(
        messages.permission.required,
        messages.permission.requiredMessage(title),
        [
          { text: messages.permission.cancel, style: 'cancel' },
          { text: messages.permission.openSettings, onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return false;
  } catch (err) {
    console.warn('Permission request error:', err);
    return false;
  }
};

// Helper for multiple permissions
const requestMultiplePermissionsDynamic = async (
  permissions: any[],
  title: string,
  message: string
): Promise<boolean> => {
  try {
    // For iOS, request permissions one by one since react-native-permissions doesn't have requestMultiple
    if (Platform.OS === 'ios') {
      for (const permission of permissions) {
        const hasPermission = await requestPermissionDynamic(permission, title, message);
        if (!hasPermission) return false;
      }
      return true;
    }

    // For Android, use the existing PermissionsAndroid.requestMultiple
    const granted: any = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = permissions.every(
      (perm: any) => granted[perm] === PermissionsAndroid.RESULTS.GRANTED
    );

    if (allGranted) return true;

    const anyNeverAskAgain = permissions.some(
      (perm: any) => granted[perm] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );

    if (anyNeverAskAgain) {
      const messages = getMessages();
      Alert.alert(
        messages.permission.required,
        messages.permission.requiredMessage(title),
        [
          { text: messages.permission.cancel, style: 'cancel' },
          { text: messages.permission.openSettings, onPress: () => Linking.openSettings() },
        ]
      );
    }

    return false;
  } catch (err) {
    console.warn('Permission request error:', err);
    return false;
  }
};

const Home: React.FC = ({ navigation, route }: any) => {
  const optionalConfigObject = getDefaultBiometricConfig();
  const webViewRef = useRef<WebView>(null);
  const [audioFiles, setAudioFiles] = useState<ReadDirItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const eventBridge = useRef(new EventBridge());
  const audioRecorderPlayer = new AudioRecorderPlayer();
  const [isDownloading, setIsDownloading] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string>(Config.WEBVIEW_URL as string);
  const [targetUrl, setTargetUrl] = useState<string>(Config.WEBVIEW_URL as string);
  const [canWebViewGoBack, setCanWebViewGoBack] = useState<boolean>(false);
  const [currentWebViewUrl, setCurrentWebViewUrl] = useState<string>('');

  // Refs to coordinate waiting for base64 and avoid duplicate preparing
  const pendingDownloadRef = useRef<any>(null);
  const preparingShownRef = useRef<boolean>(false);

  // App state tracking for suspend/resume
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());

  const DEBUG_URL_KEY = '@debug_webview_url';

  useEffect(() => {
    loadWebViewUrl();
  }, []);

  const loadWebViewUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(DEBUG_URL_KEY);
      const urlToLoad = savedUrl || Config.WEBVIEW_URL as string;
      setTargetUrl(urlToLoad);
      setWebViewUrl(urlToLoad);
    } catch (error) {
      const defaultUrl = Config.WEBVIEW_URL as string;
      setTargetUrl(defaultUrl);
      setWebViewUrl(defaultUrl);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.resetToHome) {
        console.log('Resetting WebView to home');
        resetWebViewToHome();
        navigation.setParams({ resetToHome: undefined });
      }

      // Handle URL reload when changed from debug modal
      if (route.params?.reloadUrl && route.params?.newUrl) {
        setTargetUrl(route.params.newUrl);
        setWebViewUrl(route.params.newUrl);
        navigation.setParams({ reloadUrl: undefined, newUrl: undefined });
      }
    }, [route.params?.resetToHome, route.params?.reloadUrl, route.params?.newUrl])
  );

  const resetWebViewToHome = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        window.location.href = '${targetUrl}';
        true;
      `);
    }
  };
  useEffect(() => {
    eventBridge.current.setWebViewRef(webViewRef);
  }, []);

  useEffect(() => {
    NotificationManager.registerForegroundHandler(async (filePath?: string) => {
      try {
        if (filePath) {
          const opened = await openFile(filePath);

          if (!opened) {
            const fileName = filePath.split('/').pop();
            eventBridge.current.sendToWebView('openDownloads', {
              path: filePath,
              fileName: fileName || undefined,
            });
          }
        } else {
          eventBridge.current.sendToWebView('openDownloads', {});
        }
      } catch (e) {
        console.warn('Failed to handle notification tap:', e);
        eventBridge.current.sendToWebView('openDownloads', {});
      }
    });
  }, []);


  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('AppState changed from', appState.current, 'to', nextAppState);

    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      const now = Date.now();
      const timeSinceLastActive = now - lastActiveTime.current;

      console.log('App came to foreground, time since last active:', timeSinceLastActive, 'ms');

      if (timeSinceLastActive > 30000) { // 30 seconds
        console.log('App was suspended for too long, reloading WebView...');

        if (webViewRef.current) {
          // Force reload WebView
          webViewRef.current.reload();
        }
      } else {
        console.log('App resumed quickly, no reload needed');

        eventBridge.current.sendToWebView('appResumed', {
          timestamp: now
        });
      }

      lastActiveTime.current = now;
    }

    if (nextAppState.match(/inactive|background/)) {
      lastActiveTime.current = Date.now();
    }

    appState.current = nextAppState;
  };

  const reloadVebiew = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };
  useEffect(() => {
    reloadVebiew();
  }, []);

  //Stable callback - check WebView's native canGoBack
  const sendAppBack = React.useCallback(() => {
    eventBridge.current.sendToWebView('backApp', true);
  }, [canWebViewGoBack, currentWebViewUrl]);
  // Android BackHandler
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        sendAppBack();
        return true;
      });

      return () => sub.remove();
    }, [sendAppBack])
  );

  //IOS navigation beforeRemove listener
  useFocusEffect(
    React.useCallback(() => {
      const beforeRemove = (e: any) => {

        e.preventDefault();
        sendAppBack();
      };

      console.log('Setting up navigation beforeRemove listener');
      navigation.addListener('beforeRemove', beforeRemove);
      return () => navigation.removeListener('beforeRemove', beforeRemove);
    }, [navigation, sendAppBack])
  );

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', data.data);
      console.log('Received message type:', data.type);

      switch (data.type) {
        case 'capturePhoto':
          handleCapturePhoto();
          break;

        case 'captureAudio':
          handleCaptureAudio();
          break;

        case 'selectMultiplePhotos':
          handleSelectedPhoto();
          break;

        case 'selectAudio':
          handleSelectAudio();
          break;

        case 'openVideo':
          handleSelectVideo();
          break;

        case 'captureVideo':
          handleCaptureVideo();
          break;

        case 'downloadBlob': {
          console.log('📦 Handling downloadBlob message');
          console.log('📦 data.data type:', typeof data.data, 'value:', data.data);
          const payload = data.data || {};

          const hasValidBase64 = typeof payload.base64 === 'string' && payload.base64.trim() !== '';
          if (!hasValidBase64) {
            try {
              if (!preparingShownRef.current) {
                await NotificationManager.showPreparing(payload.filename || 'download');
                preparingShownRef.current = true;
              }
            } catch (e) {
              console.warn('Failed to show preparing while waiting:', e);
            }

            if (!pendingDownloadRef.current?.timeout) {
              pendingDownloadRef.current = {
                filename: payload.filename,
                timeout: setTimeout(async () => {
                  try {
                    await NotificationManager.showError((payload.filename || 'download'), 'File data did not arrive in time');
                  } finally {
                    preparingShownRef.current = false;
                    pendingDownloadRef.current = null;
                    setIsDownloading(false);
                  }
                }, 15000)
              };
            }
            break;
          }

          // If we were waiting, clear timeout
          if (pendingDownloadRef.current?.timeout) {
            try { clearTimeout(pendingDownloadRef.current.timeout as any); } catch { }
            pendingDownloadRef.current = null;
          }

          await handleBlobDownload(payload);
          break;
        }

        case 'downloadError': {
          const msg = data?.data?.error || 'Download failed';
          await NotificationManager.showError('download', msg);
          break;
        }

        case 'sendMessInfor':
          handleOpenMessage(data.data);
          break;

        case 'sendPhoneInfor':
          handleOpenPhone(data.data);
          break;

        case 'googleMeetStartWithPhone':
          handleGoogleMeetStartWithPhone(data.data?.data);
          break;

        case 'biometricAuth':
          handleBiometricAuth(data);
          break;

        case 'biometricRegister':
          handleBiometricRegister(data);
          break;

        case 'biometricSaveToken':
          handleBiometricSaveToken(data);
          break;

        case 'appExit':
          handleExitRequest();
          break;

        case 'platform':
          checkingPlatform();
          break;

        default:
          console.log('Unknown message type:', data.type);
          break;
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.parseWebViewMessage);
    }
  };



  const handleExitRequest = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      try {
        navigation.goBack();
      } catch {
        const messages = getMessages();
        Alert.alert(messages.alert.notice, messages.alert.iosHomeScreenNotice);
      }
    }
  };

  // Biometric Handlers
  const handleBiometricAuth = async (data: any) => {
    const userId = data?.data?.userId || data?.userId;
    if (!userId) {
      console.warn('biometricAuth: missing userId');
      return;
    }
    const ok = await ensureBiometricAuth('Authenticate to continue', optionalConfigObject, false);
    if (!ok) return;

    const refreshToken = await getRefreshToken(userId);
    eventBridge.current.sendToWebView('biometricAuthResult', {
      success: true,
      userId,
      refreshToken: refreshToken || undefined,
      method: 'biometric',
      ts: Date.now(),
    });
  };

  const handleBiometricRegister = async (data: any) => {
    const userId = data?.data?.userId || data?.userId;
    const refreshToken = data?.data?.refreshToken || data?.refreshToken;
    if (!userId || !refreshToken) {
      console.warn('biometricRegister: userId and refreshToken are required');
      return;
    }
    const saved = await saveRefreshToken(userId, refreshToken);
    eventBridge.current.sendToWebView('biometricRegisterResult', {
      success: saved,
      userId,
      method: 'biometric',
      ts: Date.now(),
    });
  };

  const checkingPlatform = () => {
    let platform = "";
    if (Platform.OS === 'android') {
      platform = "android";
    }
    else if (Platform.OS === 'ios') {
      platform = "ios";
    }

    eventBridge.current.sendToWebView('platformResult', {
      result: platform
    });
  }

  const handleBiometricSaveToken = async (data: any) => {
    const userId = data?.data?.userId || data?.userId;
    const refreshToken = data?.data?.refreshToken || data?.refreshToken;
    if (!userId || !refreshToken) {
      console.warn('biometricSaveToken: userId and refreshToken are required');
      return;
    }
    const saved = await saveRefreshToken(userId, refreshToken);
    eventBridge.current.sendToWebView('biometricSaveTokenResult', {
      success: saved,
      userId,
      method: 'biometric',
      ts: Date.now(),
    });
  };

  // Helper to request storage/audio permission based on Android version
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      const permission = apiLevel >= 33
        ? PERMISSIONS.ANDROID.READ_MEDIA_AUDIO
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

      return requestPermissionDynamic(
        permission,
        'Storage Access',
        'App needs access to storage to select audio files'
      );
    } else if (Platform.OS === 'ios') {
      // iOS doesn't need explicit storage permission for media library
      return true;
    }
    return true;
  };
  const handleNativeVideoCall = (datares: any) => {
    const phoneNumber = datares.phoneNumber || datares.data;
    const messages = getMessages();

    if (!phoneNumber) {
      Alert.alert(messages.error.generic, messages.error.phoneNumberRequired);
      return;
    }
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

    Alert.alert(
      'Google Meet Video Call',
      `Make video call to: ${cleanNumber}`,
      [
        {
          text: 'Join by Phone',
          onPress: () => handleGoogleMeetJoinByPhone(cleanNumber)
        },
        {
          text: 'Start Meeting & Invite',
          onPress: () => handleGoogleMeetStartWithPhone(cleanNumber)
        },
        {
          text: 'Open Meet Dialer',
          onPress: () => handleGoogleMeetDialer()
        },
        {
          text: 'Other Options',
          onPress: () => showOtherVideoCallOptions(cleanNumber)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // ✅ Join by phone number
  const handleGoogleMeetJoinByPhone = async (phoneNumber: string) => {
    try {
      const messages = getMessages();
      if (!isGoogleMeetAvailable) {
        Alert.alert(messages.alert.featureNotAvailable, messages.alert.googleMeetAndroidOnly);
        return;
      }
      const result = await GoogleMeetModule.joinMeetingByPhone(phoneNumber);
      console.log('Google Meet joined by phone:', result);

      // Show success message
      Alert.alert(messages.success.googleMeetOpened, '');

    } catch (error) {
      console.error('Error joining Google Meet by phone:', error);
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.googleMeetFailed);
    }
  };

  // ✅ Start meeting and invite phone number
  const handleGoogleMeetStartWithPhone = async (phoneNumber: string) => {
    try {
      const messages = getMessages();
      if (!isGoogleMeetAvailable) {
        Alert.alert(messages.alert.featureNotAvailable, messages.alert.googleMeetAndroidOnly);
        return;
      }
      const result = await GoogleMeetModule.startInstantMeetingWithPhone(phoneNumber);
      console.log('Google Meet started with phone:', result);

      // Show options to share meeting link
      Alert.alert(
        'Meeting Started',
        'Google Meet opened. Share meeting link with contact?',
        [
          {
            text: 'Send via SMS',
            onPress: () => {
              const smsMessage = `Join me on Google Meet: ${result.meetingUrl}`;
              const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(smsMessage)}`;
              Linking.openURL(smsUrl);
            }
          },
          {
            text: 'Send via WhatsApp',
            onPress: () => {
              const whatsappMessage = `Join me on Google Meet: ${result.meetingUrl}`;
              const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(whatsappMessage)}`;
              Linking.openURL(whatsappUrl).catch(() => {
                Alert.alert(messages.error.generic, messages.error.whatsAppNotInstalled);
              });
            }
          },
          {
            text: 'Copy Link',
            onPress: () => {
              // Copy to clipboard if available
              console.log('Meeting link copied:', result.meetingUrl);
              Alert.alert(messages.success.copied, messages.success.meetingLinkCopied);
            }
          },
          {
            text: 'Done',
            style: 'cancel'
          }
        ]
      );

    } catch (error) {
      console.error('Error starting Google Meet with phone:', error);
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.failedToStartGoogleMeet);
    }
  };

  // ✅ Open Google Meet dialer
  const handleGoogleMeetDialer = async () => {
    try {
      const messages = getMessages();
      if (!isGoogleMeetAvailable) {
        Alert.alert(messages.alert.featureNotAvailable, messages.alert.googleMeetAndroidOnly);
        return;
      }
      const result = await GoogleMeetModule.openGoogleMeetWithDialer();
      console.log('Google Meet dialer opened:', result);

    } catch (error) {
      console.error('Error opening Google Meet dialer:', error);
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.failedToOpenGoogleMeet);
    }
  };

  // ✅ Show other video call options
  const showOtherVideoCallOptions = (phoneNumber: string) => {
    Alert.alert(
      'Other Video Call Options',
      `Call ${phoneNumber} using:`,
      [
        {
          text: 'Native Video Call',
          onPress: () => {
            const phoneUrl = `tel:${phoneNumber}`;
            Linking.openURL(phoneUrl);
          }
        },
        {
          text: 'Zalo',
          onPress: () => {
            const messages = getMessages();
            const zaloUrl = `zalo://profile/${phoneNumber}`;
            Linking.openURL(zaloUrl).catch(() => {
              Alert.alert(messages.error.generic, messages.error.zaloAppNotInstalled);
            });
          }
        },
        {
          text: 'WhatsApp',
          onPress: () => {
            const messages = getMessages();
            const whatsappUrl = `whatsapp://send?phone=${phoneNumber}`;
            Linking.openURL(whatsappUrl).catch(() => {
              Alert.alert(messages.error.generic, messages.error.whatsAppNotInstalled);
            });
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }

  const handleSelectVideo = async () => {
    try {
      // Request video library permission dynamically
      let permission;
      if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.Version.toString(), 10);
        permission = apiLevel >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_VIDEO
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      } else {
        permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
      }

      const hasPermission = await requestPermissionDynamic(
        permission,
        'Video Library Access',
        'This app needs access to your videos to select files'
      );

      if (!hasPermission) {
        const messages = getMessages();
        Alert.alert(messages.permission.required, messages.permission.videoLibraryDenied);
        return;
      }

      launchImageLibrary(
        {
          mediaType: 'video',
          quality: 1,
          includeBase64: false,
          videoQuality: 'high'
        },
        response => {
          if (response.didCancel) {
            console.log('User cancelled video picker');
            return;
          }
          if (response.errorCode) {
            console.error('Video picker error:', response.errorMessage);
            return;
          }
          if (response.assets && response.assets[0]) {
            const video = response.assets[0];
            const mediaData = {
              fileType: 'video',
              uris: [video.uri],
              name: video.fileName || 'video.mp4',
              size: video.fileSize || 0,
              duration: video.duration || 0,
              width: video.width || 0,
              height: video.height || 0
            };
            eventBridge.current.sendToWebView('getVideo', mediaData);

          }
        }
      );
    } catch (error) {
      console.error('Error selecting video:', error);
    }
  };
  const handleBlobDownload = async (downloadData: any) => {
    if (isDownloading) {
      console.log('Download already in progress, skipping...');
      return;
    }

    setIsDownloading(true);

    const { base64, filename, mimeType } = downloadData;

    try {
      if (!preparingShownRef.current) {
        await NotificationManager.showPreparing(filename || 'download');
        preparingShownRef.current = true;
        console.log('✅ Preparing notification shown immediately');
      } else {
        console.log('ℹ️ Preparing already shown earlier, skipping duplicate');
      }
    } catch (err) {
      console.error('Failed to show preparing notification:', err);
    }

    if (!base64) {
      await NotificationManager.showError(filename || 'download', 'Invalid file data received12');
      setIsDownloading(false);
      return;
    }
    // (Optional) Strict regex to detect incorrect format early
    try {
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Pattern.test(base64)) {
        throw new Error('Invalid base64 format detected');
      }
    } catch (e) {
      await NotificationManager.showError(filename || 'download', 'Invalid base64 format');
      setIsDownloading(false);
      return;
    }

    try {
      // Android 10+ (API 29+) uses scoped storage; writing to app-specific dir doesn't need permission.
      // Only request legacy external storage permission for API <= 28 when writing to public Downloads.
      let ok = true;
      const apiLevel = Platform.OS === 'android' ? parseInt(Platform.Version.toString(), 10) : 0;
      if (Platform.OS === 'android' && apiLevel <= 28) {
        ok = await requestStoragePermission();
      }
      if (!ok) {
        await NotificationManager.showError(filename, 'File storage permission not granted');
        setIsDownloading(false);
        return;
      }

      const timestamp = Date.now();

      // ✅ Handle filename and extension when mimeType is not provided
      let finalFilename;

      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        // If no filename, create default filename
        finalFilename = `download_${timestamp}`;

        // If mimeType exists, add corresponding extension
        if (mimeType) {
          if (mimeType === 'application/pdf') {
            finalFilename += '.pdf';
          } else if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
            finalFilename += '.zip';
          } else if (mimeType.startsWith('image/jpeg')) {
            finalFilename += '.jpg';
          } else if (mimeType.startsWith('image/png')) {
            finalFilename += '.png';
          }
        } else {
          // No mimeType, try to guess from base64 header
          if (base64.startsWith('/9j/')) {
            finalFilename += '.jpg'; // JPEG magic bytes
          } else if (base64.startsWith('iVBORw0KGgo')) {
            finalFilename += '.png'; // PNG magic bytes
          } else if (base64.startsWith('UEsDB')) {
            finalFilename += '.zip'; // ZIP magic bytes
          } else if (base64.startsWith('JVBERi0')) {
            finalFilename += '.pdf'; // PDF magic bytes
          } else {
            finalFilename += '.txt'; // Fallback
          }
        }
      } else {
        // Filename exists
        if (filename.includes('.')) {
          // Filename already has extension
          finalFilename = filename;
        } else {
          // Filename doesn't have extension, need to add
          if (mimeType) {
            if (mimeType === 'application/pdf') {
              finalFilename = `${filename}.pdf`;
            } else if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
              finalFilename = `${filename}.zip`;
            } else if (mimeType.startsWith('image/jpeg')) {
              finalFilename = `${filename}.jpg`;
            } else if (mimeType.startsWith('image/png')) {
              finalFilename = `${filename}.png`;
            } else {
              finalFilename = `${filename}_${timestamp}`;
            }
          } else {
            // No mimeType, guess from base64
            if (base64.startsWith('/9j/')) {
              finalFilename = `${filename}.jpg`;
            } else if (base64.startsWith('iVBORw0KGgo')) {
              finalFilename = `${filename}.png`;
            } else if (base64.startsWith('UEsDB')) {
              finalFilename = `${filename}.zip`;
            } else if (base64.startsWith('JVBERi0')) {
              finalFilename = `${filename}.pdf`;
            } else {
              finalFilename = `${filename}_${timestamp}`;
            }
          }
        }
      }

      // Determine target path with scoped-storage awareness
      let downloadDest = '';
      if (Platform.OS === 'android') {
        const api = parseInt(Platform.Version.toString(), 10);
        if (api <= 28) {
          // Pre-Android 10: can write to public Downloads
          downloadDest = `${RNFS.DownloadDirectoryPath}/${finalFilename}`;
        } else {
          // Android 10+: use app-specific external directory to avoid EACCES
          // Create a subfolder for clarity
          const appDir = `${RNFS.ExternalDirectoryPath}/downloads`;
          try {
            const exists = await RNFS.exists(appDir);
            if (!exists) await RNFS.mkdir(appDir);
          } catch (e) {
            console.warn('Failed ensuring app downloads dir, defaulting to ExternalDirectoryPath root:', e);
          }
          downloadDest = `${RNFS.ExternalDirectoryPath}/downloads/${finalFilename}`;
        }
      } else {
        downloadDest = `${RNFS.DocumentDirectoryPath}/${finalFilename}`;
      }



      // Check if file already exists
      const fileExists = await RNFS.exists(downloadDest);
      if (fileExists) {

        await RNFS.unlink(downloadDest);
      }

      // Write file from base64 (with fallback if EACCES on Android)
      try {
        await RNFS.writeFile(downloadDest, base64, 'base64');
      } catch (writeErr) {
        if (Platform.OS === 'android') {
          const msg = String((writeErr as any)?.message || writeErr);
          if (msg.includes('EACCES') || msg.includes('Permission denied')) {
            console.warn('EACCES writing to path. Retrying in app-specific dir...');
            const fallbackDir = `${RNFS.ExternalDirectoryPath}/downloads`;
            try {
              const exists = await RNFS.exists(fallbackDir);
              if (!exists) await RNFS.mkdir(fallbackDir);
            } catch { }
            const fallbackPath = `${fallbackDir}/${finalFilename}`;
            await RNFS.writeFile(fallbackPath, base64, 'base64');
            downloadDest = fallbackPath;
          } else {
            throw writeErr;
          }
        } else {
          throw writeErr;
        }
      }

      // Verify file was created
      const createdFileExists = await RNFS.exists(downloadDest);
      if (createdFileExists) {
        await RNFS.stat(downloadDest);
        await NotificationManager.showSuccess(finalFilename, downloadDest);
      } else {
        throw new Error('File was not created');
      }

    } catch (err: any) {
      await NotificationManager.showError(filename || 'unknown_file', err?.message || 'Download failed');
    } finally {
      // Reset state after 2 seconds
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);
      // Clean up flags and pending (if any)
      try {
        if (pendingDownloadRef.current?.timeout) {
          clearTimeout(pendingDownloadRef.current.timeout as any);
        }
      } catch { }
      pendingDownloadRef.current = null;
      preparingShownRef.current = false;
    }
  };
  const handleSelectAudio = async () => {
    const targetDirectory = Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath
      : `${RNFS.ExternalStorageDirectoryPath}/Android/data/com.webeditapp/files`;
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        const messages = getMessages();
        Alert.alert(messages.permission.required, messages.permission.storageDenied);
        return;
      }

      const files = await RNFS.readDir(targetDirectory);
      const audioList = files.filter(file =>
        file.isFile() &&
        (file.name.toLowerCase().endsWith('.aac') ||
          file.name.toLowerCase().endsWith('.mp3') ||
          file.name.toLowerCase().endsWith('.wav'))
      );

      if (audioList.length === 0) {
        return;
      }

      setAudioFiles(audioList);
      setModalVisible(true);

    } catch (error) {
      console.error('Error reading directory:', error);
    }
  };

  const handleAudioSelection = (selected: ReadDirItem) => {
    const mediaData = {
      fileType: 'audio',
      uri: `file://${selected.path}`,
      name: selected.name,
      size: selected.size || 0,
      type: 'audio/mpeg',
    };

    eventBridge.current.sendToWebView('mediaCaptured', mediaData);
    setModalVisible(false);
  };

  const renderAudioItem = ({ item }: { item: ReadDirItem }) => {
    const fileName = item.name || item.path.split('/').pop() || "Unknown file";
    const nameParts = fileName.split('.');
    const extension = nameParts.length > 1 ? nameParts.pop() : '';
    const name = nameParts.join('.');

    return (
      <TouchableOpacity
        style={{
          padding: 15,
          borderBottomWidth: 1,
          borderBottomColor: '#eee',
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => handleAudioSelection(item)}
      >
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#E0F2F1',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10
        }}>
          <Text style={{ fontSize: 16, color: '#00796B' }}>♪</Text>
        </View>

        <View style={{ flex: 1 }}>

          <Text
            style={{
              fontSize: 16,
              fontWeight: '500',
              color: '#333',
              marginBottom: 4
            }}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {name}
            <Text style={{ color: '#888', fontSize: 14 }}>
              {extension ? `.${extension}` : ''}
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: '#666' }}>
              Size: {(item.size / 1024).toFixed(2)} KB
            </Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {new Date(item.mtime ?? Date.now()).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const handleSelectedPhoto = async () => {
    try {
      // Request photo library permission dynamically
      let permission;
      if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.Version.toString(), 10);
        permission = apiLevel >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      } else {
        permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
      }

      const hasPermission = await requestPermissionDynamic(
        permission,
        'Photo Library Access',
        'This app needs access to your photos to select images'
      );

      if (!hasPermission) {
        const messages = getMessages();
        Alert.alert(messages.permission.required, messages.permission.photoLibraryDenied);
        return;
      }

      launchImageLibrary(
        {
          mediaType: 'photo',
          selectionLimit: 10,
          includeBase64: true,
          quality: 0.7,
        },
        response => {
          if (response.didCancel) {
            console.log('User cancelled image picker');
            return;
          }

          if (response.errorCode) {
            console.error('ImagePicker Error: ', response.errorMessage);
            return;
          }

          if (response.assets && response.assets.length > 0) {
            const base64Uris = [];


            for (const asset of response.assets) {
              if (asset.base64) {
                base64Uris.push(`data:image/jpeg;base64,${asset.base64}`);
              } else if (asset.uri) {
                base64Uris.push(asset.uri);
              }
            }
            if (base64Uris.length > 0) {
              const mediaData = {
                fileType: 'image',
                uris: base64Uris,
                count: base64Uris.length
              };
              eventBridge.current.sendToWebView('mediaCaptured', mediaData);
            }

          }
        }
      );
    } catch (error) {
      console.error('Error in handleSelectedPhoto:', error)
    }
  };
  const handleOpenMessage = (datares: any) => {
    const phoneNumber = datares.data;
    const messages = getMessages();
    if (!phoneNumber) {
      Alert.alert(messages.error.generic, messages.error.phoneNumberRequired);
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    const smsUrl = `sms:${cleanNumber}`;

    console.log('Attempting to open SMS with URL:', smsUrl);

    Linking.openURL(smsUrl)
      .then(() => {
        console.log('SMS app opened successfully');
      })
      .catch((err) => {
        console.error('Error opening SMS:', err);

        Linking.canOpenURL(smsUrl)
          .then((supported) => {
            const messages = getMessages();
            if (supported) {
              Alert.alert(messages.error.generic, messages.error.failedToOpenSMS);
            } else {
              Alert.alert(
                messages.alert.cannotOpenSMS,
                `SMS app is not available on this device.\n\nPhone number: ${cleanNumber}`,
                [
                  {
                    text: 'Copy Number',
                    onPress: () => {
                      console.log('Phone number to copy:', cleanNumber);
                    }
                  },
                  { text: 'OK' }
                ]
              );
            }
          })
          .catch(() => {
            const messages = getMessages();
            Alert.alert(
              messages.alert.cannotOpenSMS,
              `Cannot access SMS app.\n\nPhone number: ${cleanNumber}`
            );
          });
      });
  };
  const handleOpenPhone = (datares: any) => {
    const phoneNumber = datares.data;
    const messages = getMessages();
    if (!phoneNumber) {
      Alert.alert(messages.error.generic, messages.error.phoneNumberRequired);
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    const phoneUrl = `tel:${cleanNumber}`;

    console.log('Attempting to open phone with URL:', phoneUrl);

    // ✅ Try to open directly first, if error then show notification
    Linking.openURL(phoneUrl)
      .then(() => {
        console.log('Phone app opened successfully');
      })
      .catch((err) => {
        console.error('Error opening phone:', err);

        // ✅ Fallback: Check canOpenURL after failure
        Linking.canOpenURL(phoneUrl)
          .then((supported) => {
            const messages = getMessages();
            if (supported) {
              Alert.alert(messages.error.generic, messages.error.failedToOpenPhone);
            } else {
              Alert.alert(
                messages.alert.cannotOpenPhone,
                `Phone app is not available on this device.\n\nPhone number: ${cleanNumber}`,
                [
                  {
                    text: 'Copy Number',
                    onPress: () => {
                      // Copy to clipboard if available
                      console.log('Phone number to copy:', cleanNumber);
                    }
                  },
                  { text: 'OK' }
                ]
              );
            }
          })
          .catch(() => {
            const messages = getMessages();
            Alert.alert(
              messages.alert.cannotOpenPhone,
              `Cannot access phone app.\n\nPhone number: ${cleanNumber}`
            );
          });
      });
  };


  const handleCapturePhoto = async () => {
    // Request camera permission dynamically
    const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
    const hasPermission = await requestPermissionDynamic(
      permission,
      'Camera Permission',
      'This app needs access to your camera to take photos'
    );

    if (!hasPermission) {
      const messages = getMessages();
      Alert.alert(messages.permission.required, messages.permission.cameraDenied);
      return;
    }

    launchCamera({ mediaType: 'photo', quality: 0.8, includeBase64: true }, response => {
      if (response.assets && response.assets[0]) {
        console.log('Camera response:', response);
        const asset = response.assets[0];
        const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        const mediaData = {
          fileType: 'image',
          uri: base64,
          name: asset.fileName || 'photo.jpg',
          size: asset.fileSize || 0
        };
        eventBridge.current.sendToWebView('mediaCaptured', mediaData);
      }
    });
  };

  const handleCaptureAudio = async () => {
    try {
      // Request audio recording permission dynamically
      let permissions = [];
      if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.Version.toString(), 10);
        permissions = apiLevel >= 33
          ? [PERMISSIONS.ANDROID.RECORD_AUDIO, PERMISSIONS.ANDROID.READ_MEDIA_AUDIO]
          : [PERMISSIONS.ANDROID.RECORD_AUDIO, PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE, PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE];
      } else {
        permissions = [PERMISSIONS.IOS.MICROPHONE];
      }

      const hasPermission = await requestMultiplePermissionsDynamic(
        permissions,
        'Audio Recording Permission',
        'This app needs microphone and storage access to record audio'
      );

      if (!hasPermission) {
        const messages = getMessages();
        Alert.alert(messages.permission.required, messages.permission.microphoneDenied);
        return;
      }

      const timestamp = new Date().getTime();
      const fileName = `audio_${timestamp}`;
      const dirPath = Platform.OS === 'ios'
        ? RNFS.DocumentDirectoryPath
        : RNFS.ExternalDirectoryPath;

      if (Platform.OS === 'android') {
        const dirExists = await RNFS.exists(dirPath);
        if (!dirExists) {
          await RNFS.mkdir(dirPath);
        }
      }

      const audioPath = Platform.OS === 'ios'
        ? `${dirPath}/${fileName}.m4a`
        : `${dirPath}/${fileName}.aac`;

      const result = await audioRecorderPlayer.startRecorder(audioPath);
      console.log('Recording started:', result);

      audioRecorderPlayer.addRecordBackListener((e) => {
        console.log('Recording time: ', audioRecorderPlayer.mmssss);
        return;
      });

      Alert.alert(
        'Recording Audio',
        'Do you want to continue or stop recording?',
        [
          {
            text: 'Stop and Save',
            onPress: async () => {
              try {
                const result = await audioRecorderPlayer.stopRecorder();
                audioRecorderPlayer.removeRecordBackListener();
                console.log('Recording stopped:', result);

                const fileExists = await RNFS.exists(result);
                if (fileExists) {
                  const fileStats = await RNFS.stat(result);
                  const mediaData = {
                    fileType: 'audio',
                    uri: Platform.OS === 'android' ? result : `file://${result}`,
                    name: `${fileName}.${Platform.OS === 'ios' ? 'm4a' : 'aac'}`,
                    size: fileStats.size || 0,
                    duration: audioRecorderPlayer.mmssss,
                    type: Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/aac'
                  };
                  eventBridge.current.sendToWebView('mediaCaptured', mediaData);
                }
              } catch (error) {
                console.error('Error when stopping recording:', error);
              }
            }
          },
          {
            text: 'Cancel',
            onPress: async () => {
              await audioRecorderPlayer.stopRecorder();
              audioRecorderPlayer.removeRecordBackListener();

              try {
                const fileExists = await RNFS.exists(audioPath);
                if (fileExists) {
                  await RNFS.unlink(audioPath);
                }
              } catch (error) {
                console.error('Error cleaning up canceled recording:', error);
              }
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error during recording:', error);
    }
  };

  const handleCaptureVideo = async () => {
    // Request camera permission dynamically
    const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
    const hasPermission = await requestPermissionDynamic(
      permission,
      'Camera Permission',
      'This app needs access to your camera to record videos'
    );

    if (!hasPermission) {
      const messages = getMessages();
      Alert.alert(messages.permission.required, messages.permission.cameraDeniedVideo);
      return;
    }
    launchCamera({ mediaType: 'video', quality: 1 }, response => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const mediaData = {
          fileType: 'video',
          uris: [asset.uri],
          name: asset.fileName || 'video.mp4',
          size: asset.fileSize || 0
        };
        eventBridge.current.sendToWebView('videoCapture', mediaData);
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        javaScriptEnabled={true}
        onMessage={handleMessage}
        source={{ uri: webViewUrl }}
        onShouldStartLoadWithRequest={(request: WebViewNavigation) => {
          const url = request.url || '';
          setCurrentWebViewUrl(url);
          console.log('WebView navigating to URL:', url);
          console.log('webViewUrl', webViewUrl);

          if (url.startsWith('kakaomap://') || url.startsWith('intent://')) {
            openExternalApp(url);
            return false;
          }

          if (url.startsWith('market://') || url.startsWith('samsungapps://')) {
            openExternalApp(url);
            return false;
          }

          for (const p of STORE_PREFIXES) {
            if (url.startsWith(p)) {
              openExternalApp(url);  
              return false;
            }
          }

          if (url.includes('/store/apps/')) {
            openExternalApp(url);
            return false;
          }

          return true; 
        }}
        injectedJavaScript={`
          let isProcessing = false;
          let processingTimeout = null;

          function resetProcessingState() {
            isProcessing = false;
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
          }

          function sendToRN(type, data) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
            } catch (e) {
              console.error('postMessage error:', e);
            }
          }

          function handleBlobDownload(href, downloadAttr) {
            if (isProcessing) {
              console.log('Already processing a download, skipping...');
              return;
            }

            isProcessing = true;
            console.log('Starting blob processing for:', href);

            processingTimeout = setTimeout(resetProcessingState, 5000);

            let filename = downloadAttr;
            if (!filename || filename.trim() === '') {
              filename = 'download_' + Date.now();
            }

            // (Don't send downloadStart; native will showPreparing when receiving downloadBlob)

            fetch(href)
              .then(response => {
                console.log('Fetch response status:', response.status);
                if (!response.ok) {
                  throw new Error('Network response was not ok: ' + response.status);
                }
                return response.blob();
              })
              .then(blob => {
                if (!blob || blob.size === 0) {
                  throw new Error('Empty or invalid blob received');
                }

                // (Don't send downloadReady; keep logic simple)

                const reader = new FileReader();
                reader.onload = function() {
                  try {
                    const result = reader.result;
                    if (!result) throw new Error('FileReader result is null');
                    if (typeof result !== 'string') throw new Error('FileReader result is not a string');

                    const commaIndex = result.indexOf(',');
                    if (commaIndex === -1) throw new Error('Invalid data URL format - no comma found');

                    const base64 = result.substring(commaIndex + 1);
                    if (!base64 || base64.length === 0) {
                      throw new Error('Empty base64 data after extraction');
                    }

                    // Validate base64 format (strict)
                    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
                    if (!base64Pattern.test(base64)) {
                      throw new Error('Invalid base64 format detected');
                    }

                    const dataToSend = { base64, filename };
                    if (blob.type && blob.type.trim() !== '') dataToSend.mimeType = blob.type;

                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'downloadBlob',
                      data: dataToSend
                    }));

                    resetProcessingState();
                  } catch (error) {
                    console.error('Error processing FileReader result:', error);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'downloadError',
                      data: { error: 'Failed to process file: ' + error.message }
                    }));
                    resetProcessingState();
                  }
                };

                reader.onerror = function() {
                  console.error('FileReader error occurred');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'downloadError',
                    data: { error: 'Failed to read file data' }
                  }));
                  resetProcessingState();
                };

                reader.readAsDataURL(blob);
              })
              .catch(error => {
                console.error('Error fetching blob:', error);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'downloadError',
                  data: { error: 'Failed to fetch file: ' + error.message }
                }));
                resetProcessingState();
              });
          }

          if (!window.openOverridden) {
            const originalOpen = window.open;
            window.open = function(url, target, features) {
              if (url && url.startsWith('blob:')) {
                handleBlobDownload(url, '');
                return null;
              }
              return originalOpen.call(this, url, target, features);
            };
            window.openOverridden = true;
          }

          if (!window.clickListenerAdded) {
            document.addEventListener('click', function(e) {
              const target = e.target.closest('a');
              if (target && target.href && target.href.startsWith('blob:')) {
                e.preventDefault();
                e.stopPropagation();
                const href = target.href;
                const download = target.download || target.getAttribute('download') || '';
                handleBlobDownload(href, download);
              }
            }, { once: false, passive: false });
            window.clickListenerAdded = true;
          }

          true;

        `}
        {...(Platform.OS === 'ios' ? {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
        } : {})}
        allowsFullscreenVideo={true}
        domStorageEnabled={true}
        incognito={false}
        sharedCookiesEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error: ', nativeEvent);

        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error(`WebView HTTP error: ${nativeEvent.statusCode}`);
        }}
        onLoadProgress={({ nativeEvent }) => {
          console.log(`WebView loading: ${nativeEvent.progress * 100}%`);
        }}
        onNavigationStateChange={(navState) => {
          if (!navState.loading) {
            setCanWebViewGoBack(navState.canGoBack);
          }
        }}
        onContentProcessDidTerminate={() => {
          console.warn('⚠️ WebView process was terminated by iOS, reloading...');
          webViewRef.current?.reload();
        }}
        originWhitelist={['*']}
        {...(Platform.OS === 'android' ? { mixedContentMode: "compatibility" } : {})}
        style={styles.webview}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        scalesPageToFit={false}
        scrollEnabled={true}
        keyboardDisplayRequiresUserAction={false}
        automaticallyAdjustContentInsets={true}
        injectedJavaScriptBeforeContentLoaded={`
          const meta = document.createElement('meta');
          meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
          meta.setAttribute('name', 'viewport');
          document.getElementsByTagName('head')[0].appendChild(meta);
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
          document.head.appendChild(meta);
          true;
        `}
      />
      <View>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}>
            <View style={{
              backgroundColor: 'white',
              margin: 20,
              borderRadius: 10,
              maxHeight: '80%'
            }}>
              <Text style={{
                padding: 15,
                textAlign: 'center',
                borderBottomWidth: 1,
                borderBottomColor: '#ccc'
              }}>
                Select an Audio File
              </Text>

              <FlatList
                data={audioFiles}
                renderItem={renderAudioItem}
                keyExtractor={item => item.path}
                style={{ maxHeight: '70%' }}
              />

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{
                  padding: 15,
                  borderTopWidth: 1,
                  borderTopColor: '#ccc'
                }}
              >
                <Text style={{ textAlign: 'center', color: '#FF3B30' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default Home;

