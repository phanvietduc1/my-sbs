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
import EventBridge, { ACTIONS } from './bridge/eventBrigde';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS, { ReadDirItem } from 'react-native-fs';
import { ensureBiometricAuth, defaultBiometricConfig } from './utils/biometrics';
import { saveRefreshToken, getRefreshToken } from './utils/secureToken';
import { NativeModules } from 'react-native';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationManager } from './utils/NotificationManager';
import { openFolder } from './utils/FileOpener';
import { DownloadManager } from './utils/DownloadManager';
import DebugModal from './components/DebugModal';
import { getMessages } from './constants/Messages';
import Clipboard from '@react-native-clipboard/clipboard';
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

const Home: React.FC = () => {
  const optionalConfigObject = defaultBiometricConfig;
  const webViewRef = useRef<WebView>(null);
  const [audioFiles, setAudioFiles] = useState<ReadDirItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const eventBridge = useRef(new EventBridge());
  const audioRecorderPlayer = new AudioRecorderPlayer();
  const [isDownloading, setIsDownloading] = useState(false);

  const [webViewUrl, setWebViewUrl] = useState<string>(Platform.OS === 'android' ? 'about:blank' : Config.WEBVIEW_URL as string);
  const [canWebViewGoBack, setCanWebViewGoBack] = useState<boolean>(false);
  const [currentWebViewUrl, setCurrentWebViewUrl] = useState<string>(Platform.OS === 'android' ? 'about:blank' : Config.WEBVIEW_URL as string);

  const [showDebugModal, setShowDebugModal] = useState(false);

  // Only Android needs about:blank skip logic
  const allowAboutBlankOnceRef = React.useRef(Platform.OS === 'android');

  // Refs to coordinate waiting for base64 and avoid duplicate preparing
  const pendingDownloadRef = useRef<any>(null);
  const preparingShownRef = useRef<boolean>(false);

  // App state tracking for suspend/resume
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());

  const DEBUG_URL_KEY = '@debug_webview_url';

  useEffect(() => {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(Config.ONESIGNAL_APP_ID as string);
    OneSignal.Notifications.requestPermission(false);

    loadWebViewUrl();
    // Clear WebView cache on iOS when component mounts to prevent blob URL errors
    if (Platform.OS === 'ios' && webViewRef.current) {
      // Clear cache after a short delay to ensure WebView is ready
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          if (window.caches) {
            caches.keys().then(keys => {
              keys.forEach(key => caches.delete(key));
              console.log('✅ Cache cleared on mount');
            });
          }
          true;
        `);
      }, 500);
    }
  }, []);

  const loadWebViewUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(DEBUG_URL_KEY);
      const urlToLoad = savedUrl || Config.WEBVIEW_URL as string;

      if (Platform.OS === 'android') {
        // Android: Load the actual URL after about:blank is loaded
        setTimeout(() => {
          setWebViewUrl(urlToLoad);
        }, 100);
      } else {
        // iOS: Load URL directly without about:blank
        setWebViewUrl(urlToLoad);
      }
    } catch (error) {
      const defaultUrl = Config.WEBVIEW_URL as string;
      if (Platform.OS === 'android') {
        setTimeout(() => setWebViewUrl(defaultUrl), 100);
      } else {
        setWebViewUrl(defaultUrl);
      }
    }
  };

  useEffect(() => {
    eventBridge.current.setWebViewRef(webViewRef);
  }, []);

  useEffect(() => {
    NotificationManager.registerForegroundHandler(async (filePath?: string) => {
      try {
        const opened = await openFolder();

        if (!opened) {
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
          // Clear WebView cache to prevent blob URL errors
          if (Platform.OS === 'ios') {
            webViewRef.current.injectJavaScript(`
              if (window.caches) {
                caches.keys().then(keys => {
                  keys.forEach(key => caches.delete(key));
                  console.log('✅ Cache cleared');
                });
              }
              true;
            `);
          }
          // Force reload WebView after clearing cache
          setTimeout(() => {
            webViewRef.current?.reload();
          }, 500);
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
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sendAppBack();
      return true;
    });

    return () => sub.remove();
  }, [sendAppBack]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        // Media actions
        case ACTIONS.CAPTURE_PHOTO:
          handleCapturePhoto();
          break;

        case ACTIONS.CAPTURE_VIDEO:
          handleCaptureVideo();
          break;

        case ACTIONS.CAPTURE_AUDIO:
          handleCaptureAudio();
          break;

        case ACTIONS.SELECT_MULTIPLE_PHOTOS:
          handleSelectedPhoto();
          break;

        case ACTIONS.SELECT_AUDIO:
          handleSelectAudio();
          break;

        case ACTIONS.OPEN_VIDEO:
          handleSelectVideo();
          break;

        case ACTIONS.SELECT_VIDEO: 
          handleSelectVideo();
          break;

        case ACTIONS.GET_VIDEO:
          console.log('GET_VIDEO action received');
          break;

        // Download actions
        case 'downloadRequest': {
          const { url, headers } = data.data;
          try {
            await DownloadManager.downloadSingleFile({ url, headers });
          } catch (error) {
            console.error('Download request failed:', error);
          }
          break;
        }

        case 'downloadMultipleRequest': {
          const { fileIdList, headers, apiUrl } = data.data;
          try {
            await DownloadManager.downloadMultipleFiles({ fileIdList, headers, apiUrl });
          } catch (error) {
            console.error('Multiple download request failed:', error);
          }
          break;
        }

        case ACTIONS.APP_EXIT:
          handleExitRequest();
          break;

        // Clipboard actions
        case ACTIONS.COPY:
          console.log('📱 Copying to clipboard:', data?.data);
          const htmlText = data?.data || '';
          const text = htmlText.replace(/<[^>]*>/g, '');
          Clipboard.setString(text);
          break;

        case ACTIONS.PASTE:
          const pasteText = await Clipboard.getString();
          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'PASTE_RESULT', text: pasteText })
          );
          break;

        case ACTIONS.REQUEST_CLIPBOARD_STATE:
          console.log('📱 Requesting clipboard state');
          const currentText = await Clipboard.getString();
          const message = JSON.stringify({
            type: 'CLIPBOARD_STATE',
            hasClipboard: !!currentText,
          });
          console.log('📱 Clipboard state to send:', message);
          webViewRef.current?.postMessage(message);
          break;

        // Modal actions
        case ACTIONS.OPEN_MODAL_SWITCH_URL:
          setShowDebugModal(true);
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

  const handleUrlChanged = (newUrl: string) => {
    console.log('🔄 URL changed to:', newUrl);
    setWebViewUrl(newUrl);
  };

  const handleExitRequest = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      Alert.alert('Notice', 'You are on the home screen; iOS does not allow exiting the app programmatically.');
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

          if (url.startsWith('blob:') || url.includes('blob:')) {
            // Inject JavaScript to handle blob URL if needed (e.g., for file downloads)
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                // Try to revoke the blob URL to clean up
                try {
                  if (window.URL && window.URL.revokeObjectURL) {
                    window.URL.revokeObjectURL('${url}');
                  }
                } catch(e) {
                  console.warn('Failed to revoke blob URL:', e);
                }
                true;
              `);
            }
            return false; // Block blob URL navigation
          }

          if (url.startsWith('kakaomap://') || url.startsWith('intent://')) {
            openExternalApp(url);
            return false;
          }

          // Only Android uses about:blank logic
          if (Platform.OS === 'android' && url.startsWith('about:blank')) {
            if (allowAboutBlankOnceRef.current) {
              allowAboutBlankOnceRef.current = false;
              return true;
            }
            console.log('Blocked navigating back to about:blank');
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

          if (!window.fetchIntercepted) {
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              const [resource, config] = args;
              const url = typeof resource === 'string' ? resource : resource.url;
              
              // Intercept single file download
              if (url && url.includes('/api/attachment-file/download') && !url.includes('/download-all')) {
                console.log('🎯 Intercepted single download API call:', url);
                
                let accessToken = '';
                if (config && config.headers) {
                  if (config.headers instanceof Headers) {
                    accessToken = config.headers.get('Authorization') || 
                                  config.headers.get('authorization') || 
                                  config.headers.get('access-token') || '';
                  } else {
                    accessToken = config.headers['Authorization'] || 
                                  config.headers['authorization'] || 
                                  config.headers['access-token'] || '';
                  }
                }
                if (!accessToken) {
                  try {
                    accessToken = localStorage.getItem('access_token') || 
                                  localStorage.getItem('accessToken') || 
                                  localStorage.getItem('token') || '';
                  } catch (e) {
                    console.warn('Failed to get token from localStorage:', e);
                  }
                }
                
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  const headers = {};
                  if (accessToken) {
                    headers['Authorization'] = accessToken.startsWith('Bearer ') ? accessToken : \`Bearer \${accessToken}\`;
                    headers['access-token'] = accessToken;
                  }
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'downloadRequest',
                    data: { url, headers }
                  }));
                  
                  // Return empty response 
                  return Promise.resolve(new Response(null, { 
                    status: 200, 
                    statusText: 'Handled by native' 
                  }));
                } else {
                  console.warn('ReactNativeWebView not available, using original fetch');
                }
              }
              
              // Intercept multiple files download
              if (url && url.includes('/api/attachment-file/download-all')) {
                console.log('🎯 Intercepted multiple download API call:', url);
                
                let accessToken = '';
                let requestBody = null;
                
                // Extract headers
                if (config && config.headers) {
                  if (config.headers instanceof Headers) {
                    accessToken = config.headers.get('Authorization') || 
                                  config.headers.get('authorization') || 
                                  config.headers.get('access-token') || '';
                  } else {
                    accessToken = config.headers['Authorization'] || 
                                  config.headers['authorization'] || 
                                  config.headers['access-token'] || '';
                  }
                }
                if (!accessToken) {
                  try {
                    accessToken = localStorage.getItem('access_token') || 
                                  localStorage.getItem('accessToken') || 
                                  localStorage.getItem('token') || '';
                  } catch (e) {
                    console.warn('Failed to get token from localStorage:', e);
                  }
                }
                
                // Extract body (fileIdList)
                if (config && config.body) {
                  try {
                    requestBody = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
                  } catch (e) {
                    console.warn('Failed to parse request body:', e);
                    requestBody = config.body;
                  }
                }
                
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  const headers = {};
                  if (accessToken) {
                    headers['Authorization'] = accessToken.startsWith('Bearer ') ? accessToken : \`Bearer \${accessToken}\`;
                    headers['access-token'] = accessToken;
                  }
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'downloadMultipleRequest',
                    data: { 
                      fileIdList: requestBody?.fileIdList || [],
                      headers,
                      apiUrl: url
                    }
                  }));
                  
                  // Return empty response 
                  return Promise.resolve(new Response(null, { 
                    status: 200, 
                    statusText: 'Handled by native' 
                  }));
                } else {
                  console.warn('ReactNativeWebView not available, using original fetch');
                }
              }
              
              return originalFetch.apply(this, args);
            };
            window.fetchIntercepted = true;
            console.log('✅ Fetch interceptor installed');
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

          // Handle blob URL errors on iOS
          if (Platform.OS === 'ios') {
            const errorDescription = nativeEvent?.description || '';
            const errorDomain = nativeEvent?.domain || '';
            const errorCode = nativeEvent?.code?.toString() || '';

            // Check for WebKitBlobResource domain specifically
            const isBlobError = errorDomain === 'WebKitBlobResource' ||
              errorDescription.includes('blob') ||
              errorDescription.includes('webkitblobresource') ||
              errorDescription.includes('WebKitBlobResource') ||
              errorCode.includes('blob');

            if (isBlobError) {
              console.warn('🔄 WebKitBlobResource error detected, handling...');
              // Clear cache but don't reload - let native error handler manage recovery
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`
                  if (window.caches) {
                    caches.keys().then(keys => {
                      keys.forEach(key => caches.delete(key));
                    });
                  }
                  // Revoke any remaining blob URLs
                  if (window.URL && window.URL.revokeObjectURL) {
                    try {
                      Object.keys(window).forEach(key => {
                        if (key.startsWith('blob:')) {
                          window.URL.revokeObjectURL(key);
                        }
                      });
                    } catch(e) {}
                  }
                  true;
                `);
              }
            }
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error(`WebView HTTP error: ${nativeEvent.statusCode}`);
        }}
        onLoadStart={(syntheticEvent) => {
          // Clear blob URLs cache on iOS before loading
          if (Platform.OS === 'ios') {
            const url = syntheticEvent.nativeEvent.url || '';
            if (url.includes('blob:') || url.startsWith('blob:')) {
              webViewRef.current?.injectJavaScript(`
                if (window.caches) {
                  caches.keys().then(keys => {
                    keys.forEach(key => caches.delete(key));
                  });
                }
                // Clear all blob URLs
                if (window.URL && window.URL.revokeObjectURL) {
                  try {
                    const keys = Object.keys(window);
                    keys.forEach(key => {
                      if (key.startsWith('blob:')) {
                        window.URL.revokeObjectURL(key);
                      }
                    });
                  } catch(e) {}
                }
                true;
              `);
            }
          }
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
          console.warn('⚠️ WebView process was terminated by iOS, clearing cache and reloading...');
          if (Platform.OS === 'ios' && webViewRef.current) {
            // Clear cache before reload to prevent blob URL errors
            webViewRef.current.injectJavaScript(`
              if (window.caches) {
                caches.keys().then(keys => {
                  keys.forEach(key => caches.delete(key));
                  console.log('✅ Cache cleared after process termination');
                });
              }
              true;
            `);
            setTimeout(() => {
              webViewRef.current?.reload();
            }, 500);
          } else {
            webViewRef.current?.reload();
          }
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
          // Clear blob URLs and cache to prevent webkitblobresource errors
          (function() {
            try {
              // Clear all blob URLs
              if (window.URL && window.URL.revokeObjectURL) {
                const blobKeys = Object.keys(window).filter(key => key.startsWith('blob:'));
                blobKeys.forEach(key => {
                  try {
                    window.URL.revokeObjectURL(key);
                  } catch(e) {}
                });
              }
              
              // Clear caches
              if (window.caches) {
                caches.keys().then(keys => {
                  keys.forEach(key => caches.delete(key));
                }).catch(e => {});
              }
            } catch(e) {}
          })();
          
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

      {/* Debug Modal */}
      <DebugModal
        visible={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        onUrlChanged={handleUrlChanged}
      />
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

