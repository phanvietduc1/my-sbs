export const MessagesEN = {
  update: {
    title: 'Update Available',
    versionAvailable: (newVersion: string) => `Version ${newVersion} is available`,
    currentVersion: (oldVersion: string) => `Current: ${oldVersion}`,
    later: 'Later',
    updateNow: 'Update Now',
    downloadUrlNotFound: 'Download URL not found',
    updateAvailable: 'Update Available',
    androidRedirect: 'You will be redirected to download the APK file. After downloading, please install it manually.',
    iosRedirect: 'You will be redirected to install the new version via Enterprise Distribution.',
    versionInfo: (newVersion: string, oldVersion: string) => `${MessagesEN.update.androidRedirect}\n\nNew Version: ${newVersion}\nCurrent: ${oldVersion}`,
    cancel: 'Cancel',
    download: 'Download',
    cannotOpenUrl: (platform: string, url: string) => `Cannot open this URL on ${platform}:\n${url}\n\nPlease check the URL format.`,
    errorOpeningUrl: (url: string, error: string) => `Cannot open download link:\n${url}\n\nError: ${error}\n\nPlease open your browser and visit the link manually.`,
    unableToOpenLink: 'Unable to open download link. Please try again later.',
  },

  error: {
    generic: 'Error',
    parseWebViewMessage: 'Failed to parse message from WebView',
    phoneNumberRequired: 'Phone number is required',
    whatsAppNotInstalled: 'WhatsApp not installed',
    zaloAppNotInstalled: 'Zalo app not installed',
    failedToOpenSMS: 'Failed to open SMS app. Please try again.',
    failedToOpenPhone: 'Failed to open phone app. Please try again.',
    fileNotFound: 'File not found',
    unableToOpenFile: (message: string) => `Unable to open file: ${message}`,
    unableToSaveUrl: 'Unable to save URL',
    downloadFailed: 'Download failed',
    unknownFile: 'unknown_file',
    fileNotCreated: 'File was not created',
    fileDataTimeout: 'File data did not arrive in time',
    googleMeetFailed: 'Failed to join Google Meet by phone',
    failedToOpenGoogleMeet: 'Failed to open Google Meet dialer',
    failedToStartGoogleMeet: 'Failed to start Google Meet with phone',
  },

  permission: {
    required: 'Permission Required',
    requiredMessage: (title: string) => `${title} is required for this feature. Please enable it in Settings.`,
    cancel: 'Cancel',
    openSettings: 'Open Settings',
    photoLibraryDenied: 'Photo library access is required to select images',
    cameraDenied: 'Camera access is required to take photos',
    cameraDeniedVideo: 'Camera access is required to record videos',
    microphoneDenied: 'Microphone access is required to record audio',
    videoLibraryDenied: 'Video library access is required to select videos',
    storageDenied: 'Storage access is required to select audio files',
  },

  notification: {
    preparingDownload: (index?: number, total?: number) => {
      const prefix = index && total ? `(${index}/${total}) ` : '';
      return `${prefix}Preparing download`;
    },
    downloading: 'Downloading',
    downloadComplete: 'Download complete',
    downloadFailed: 'Download failed',
    savedFile: (filename: string) => `Saved: ${filename}`,
    couldNotDownload: (filename?: string) => `Could not download: ${filename || 'file'}`,
    fileDownload: (filename: string) => `File: ${filename}`,
    unknownFile: 'unknown...',
    openFile: 'Open file',
    channelName: 'File downloads',
  },

  success: {
    googleMeetOpened: 'Google Meet opened for phone call',
    copied: 'Copied',
    meetingLinkCopied: 'Meeting link copied to clipboard',
  },

  debug: {
    modalTitle: '🔧 Debug: Switch URL',
    urlCurrent: 'URL current:',
    productionUrl: 'Production URL',
    developmentUrl: 'Development URL',
    cancel: 'Cancel',
    urlChanged: 'URL Changed',
    urlChangedMessage: (isProduction: boolean, url: string) => 
      `The URL has been changed to: ${isProduction ? 'Production' : 'Development'}\nThe app will reload to apply the change.`,
    ok: 'OK',
  },

  alert: {
    notice: 'Notice',
    iosHomeScreenNotice: 'You are on the home screen; iOS does not allow exiting the app programmatically.',
    featureNotAvailable: 'Feature Not Available',
    googleMeetAndroidOnly: 'Google Meet integration is only available on Android',
    cannotOpenWhatsApp: 'Cannot open WhatsApp. Please make sure WhatsApp is installed.',
    cannotOpenZalo: 'Cannot open Zalo. Please make sure Zalo is installed.',
    cannotOpenSMS: 'Cannot open SMS app. Your device may not support SMS.',
    cannotOpenPhone: 'Cannot open phone app. Your device may not support phone calls.',
    cannotMakeCall: 'Cannot make a phone call. Please check your device settings.',
  },

  biometric: {
    unavailable: 'Biometric Unavailable',
    unavailableIOS: 'Face ID / Touch ID is not available or not enrolled.',
    unavailableAndroid: 'Fingerprint is not available or not enrolled.',
    authenticationFailed: 'Authentication Failed',
    authenticationCanceled: 'Authentication was canceled.',
    userCanceled: 'You canceled authentication.',
    authenticationFailedGeneric: 'Biometric authentication failed',
    loginWithFingerprint: 'Login with Fingerprint',
    touchFingerprint: 'Touch the fingerprint sensor',
    authenticationFailedDesc: 'Authentication failed',
    cancel: 'Cancel',
    authenticateToContinue: 'Authenticate to continue',
    authenticate: 'Authenticate',
    authenticateToProceed: 'Authenticate to proceed',
  },

  file: {
    openFolder: 'Open Folder',
    fileSavedAt: (filePath: string) => `File saved at:\n${filePath}\n\nDo you want to open the folder containing this file?`,
    cancel: 'Cancel',
    openFolderButton: 'Open Folder',
    noticeOpenFileManager: 'Please open the File Manager app to view the downloaded file',
    noticeIOS: (filePath: string) => `File saved at:\n${filePath}\n\nPlease open the Files app to view.`,
    openFile: 'Open File',
  },

  sms: {
    defaultMessage: 'Hello',
    sendSMS: (phoneNumber: string) => `Send SMS to ${phoneNumber}?`,
    confirm: 'Send',
  },

  phone: {
    makeCall: (phoneNumber: string) => `Make a call to ${phoneNumber}?`,
    call: 'Call',
  },
} as const;

export const MessagesKO = {
  update: {
    title: '업데이트 사용 가능',
    versionAvailable: (newVersion: string) => `버전 ${newVersion}이(가) 사용 가능합니다`,
    currentVersion: (oldVersion: string) => `현재: ${oldVersion}`,
    later: '나중에',
    updateNow: '지금 업데이트',
    downloadUrlNotFound: '다운로드 URL을 찾을 수 없습니다',
    updateAvailable: '업데이트 사용 가능',
    androidRedirect: 'APK 파일을 다운로드하도록 리디렉션됩니다. 다운로드 후 수동으로 설치해주세요.',
    iosRedirect: 'Enterprise Distribution을 통해 새 버전을 설치하도록 리디렉션됩니다.',
    versionInfo: (newVersion: string, oldVersion: string) => `${MessagesKO.update.androidRedirect}\n\n새 버전: ${newVersion}\n현재: ${oldVersion}`,
    cancel: '취소',
    download: '다운로드',
    cannotOpenUrl: (platform: string, url: string) => `${platform}에서 이 URL을 열 수 없습니다:\n${url}\n\nURL 형식을 확인해주세요.`,
    errorOpeningUrl: (url: string, error: string) => `다운로드 링크를 열 수 없습니다:\n${url}\n\n오류: ${error}\n\n브라우저를 열어 링크를 수동으로 방문해주세요.`,
    unableToOpenLink: '다운로드 링크를 열 수 없습니다. 나중에 다시 시도해주세요.',
  },

  error: {
    generic: '오류',
    parseWebViewMessage: 'WebView 메시지 파싱에 실패했습니다',
    phoneNumberRequired: '전화번호가 필요합니다',
    whatsAppNotInstalled: 'WhatsApp이 설치되어 있지 않습니다',
    zaloAppNotInstalled: 'Zalo 앱이 설치되어 있지 않습니다',
    failedToOpenSMS: 'SMS 앱을 열 수 없습니다. 다시 시도해주세요.',
    failedToOpenPhone: '전화 앱을 열 수 없습니다. 다시 시도해주세요.',
    fileNotFound: '파일을 찾을 수 없습니다',
    unableToOpenFile: (message: string) => `파일을 열 수 없습니다: ${message}`,
    unableToSaveUrl: 'URL을 저장할 수 없습니다',
    downloadFailed: '다운로드 실패',
    unknownFile: '알 수 없는 파일',
    fileNotCreated: '파일이 생성되지 않았습니다',
    fileDataTimeout: '파일 데이터가 시간 내에 도착하지 않았습니다',
    googleMeetFailed: '전화로 Google Meet에 참여하는 데 실패했습니다',
    failedToOpenGoogleMeet: 'Google Meet 다이얼러를 열 수 없습니다',
    failedToStartGoogleMeet: '전화로 Google Meet를 시작하는 데 실패했습니다',
  },

  permission: {
    required: '권한 필요',
    requiredMessage: (title: string) => `이 기능에 ${title} 권한이 필요합니다. 설정에서 활성화해주세요.`,
    cancel: '취소',
    openSettings: '설정 열기',
    photoLibraryDenied: '이미지를 선택하려면 사진 라이브러리 접근 권한이 필요합니다',
    cameraDenied: '사진을 촬영하려면 카메라 접근 권한이 필요합니다',
    cameraDeniedVideo: '비디오를 녹화하려면 카메라 접근 권한이 필요합니다',
    microphoneDenied: '오디오를 녹음하려면 마이크 접근 권한이 필요합니다',
    videoLibraryDenied: '비디오를 선택하려면 비디오 라이브러리 접근 권한이 필요합니다',
    storageDenied: '오디오 파일을 선택하려면 저장소 접근 권한이 필요합니다',
  },

  notification: {
    preparingDownload: (index?: number, total?: number) => {
      const prefix = index && total ? `(${index}/${total}) ` : '';
      return `${prefix}다운로드 준비 중`;
    },
    downloading: '다운로드 중',
    downloadComplete: '다운로드 완료',
    downloadFailed: '다운로드 실패',
    savedFile: (filename: string) => `저장됨: ${filename}`,
    couldNotDownload: (filename?: string) => `다운로드할 수 없습니다: ${filename || '파일'}`,
    fileDownload: (filename: string) => `파일: ${filename}`,
    unknownFile: '알 수 없음...',
    openFile: '파일 열기',
    channelName: '파일 다운로드',
  },

  success: {
    googleMeetOpened: '전화 통화를 위해 Google Meet이 열렸습니다',
    copied: '복사됨',
    meetingLinkCopied: '회의 링크가 클립보드에 복사되었습니다',
  },

  debug: {
    modalTitle: '🔧 디버그: URL 전환',
    urlCurrent: '현재 URL:',
    productionUrl: '프로덕션 URL',
    developmentUrl: '개발 URL',
    cancel: '취소',
    urlChanged: 'URL 변경됨',
    urlChangedMessage: (isProduction: boolean, url: string) => 
      `URL이 ${isProduction ? '프로덕션' : '개발'}으로 변경되었습니다.\n변경사항을 적용하기 위해 앱이 다시 로드됩니다.`,
    ok: '확인',
  },

  alert: {
    notice: '알림',
    iosHomeScreenNotice: '홈 화면에 있습니다. iOS에서는 프로그래밍 방식으로 앱을 종료할 수 없습니다.',
    featureNotAvailable: '기능 사용 불가',
    googleMeetAndroidOnly: 'Google Meet 통합은 Android에서만 사용 가능합니다',
    cannotOpenWhatsApp: 'WhatsApp을 열 수 없습니다. WhatsApp이 설치되어 있는지 확인해주세요.',
    cannotOpenZalo: 'Zalo를 열 수 없습니다. Zalo가 설치되어 있는지 확인해주세요.',
    cannotOpenSMS: 'SMS 앱을 열 수 없습니다. 기기가 SMS를 지원하지 않을 수 있습니다.',
    cannotOpenPhone: '전화 앱을 열 수 없습니다. 기기가 전화 통화를 지원하지 않을 수 있습니다.',
    cannotMakeCall: '전화 통화를 할 수 없습니다. 기기 설정을 확인해주세요.',
  },

  biometric: {
    unavailable: '생체 인식 사용 불가',
    unavailableIOS: 'Face ID / Touch ID를 사용할 수 없거나 등록되지 않았습니다.',
    unavailableAndroid: '지문 인식을 사용할 수 없거나 등록되지 않았습니다.',
    authenticationFailed: '인증 실패',
    authenticationCanceled: '인증이 취소되었습니다.',
    userCanceled: '인증을 취소하셨습니다.',
    authenticationFailedGeneric: '생체 인증에 실패했습니다',
    loginWithFingerprint: '지문으로 로그인',
    touchFingerprint: '지문 센서를 터치하세요',
    authenticationFailedDesc: '인증 실패',
    cancel: '취소',
    authenticateToContinue: '계속하려면 인증하세요',
    authenticate: '인증',
    authenticateToProceed: '진행하려면 인증하세요',
  },

  file: {
    openFolder: '폴더 열기',
    fileSavedAt: (filePath: string) => `파일 저장 위치:\n${filePath}\n\n이 파일이 포함된 폴더를 열시겠습니까?`,
    cancel: '취소',
    openFolderButton: '폴더 열기',
    noticeOpenFileManager: '다운로드한 파일을 보려면 파일 관리자 앱을 열어주세요',
    noticeIOS: (filePath: string) => `파일 저장 위치:\n${filePath}\n\n파일 앱을 열어 확인해주세요.`,
    openFile: '파일 열기',
  },

  sms: {
    defaultMessage: '안녕하세요',
    sendSMS: (phoneNumber: string) => `${phoneNumber}로 SMS를 보내시겠습니까?`,
    confirm: '보내기',
  },

  phone: {
    makeCall: (phoneNumber: string) => `${phoneNumber}로 전화를 걸겠습니까?`,
    call: '통화',
  },
} as const;

export type Locale = 'en' | 'ko';
let currentLocale: Locale = 'ko';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getMessages() {
  return currentLocale === 'ko' ? MessagesKO : MessagesEN;
}

export const Messages = MessagesKO; 
export type MessagesType = typeof MessagesEN;