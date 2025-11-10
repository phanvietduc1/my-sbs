import { Platform, Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import { getMessages } from '../constants/Messages';

/**
 * Open file with appropriate app based on MIME type
 * @param filePath - Absolute path to the file to open
 * @returns Promise<boolean> - true if opened successfully, false if failed
 */
export async function openFile(filePath: string): Promise<boolean> {
  try {
    // Check if file exists
    const fileExists = await RNFS.exists(filePath);
    if (!fileExists) {
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.fileNotFound);
      console.error('File not found:', filePath);
      return false;
    }

    if (Platform.OS === 'android') {
      return await openFileAndroid(filePath);
    } else if (Platform.OS === 'ios') {
      return await openFileIOS(filePath);
    }
    
    return false;
  } catch (error) {
    console.error('Error opening file:', error);
    const messages = getMessages();
    Alert.alert(messages.error.generic, messages.error.unableToOpenFile((error as Error).message));
    return false;
  }
}

/**
 * Open file on Android using Intent
 */
async function openFileAndroid(filePath: string): Promise<boolean> {
  try {
    const { FileOpenerModule } = NativeModules;
    
    if (!FileOpenerModule) {
      // Fallback: Try opening with file manager
      console.warn('FileOpenerModule not available, using fallback');
      return await openFileManagerAndroid(filePath);
    }

    // Determine MIME type from extension
    const mimeType = getMimeType(filePath);
    
    // Call native module to open file
    await FileOpenerModule.openFile(filePath, mimeType);
    return true;
    
  } catch (error) {
    console.error('Error opening file on Android:', error);
    
    // Fallback: Open file manager
    return await openFileManagerAndroid(filePath);
  }
}

/**
 * Open file manager and highlight file
 */
async function openFileManagerAndroid(filePath: string): Promise<boolean> {
  try {
    // Get folder containing the file
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
    
    const messages = getMessages();
    Alert.alert(
      messages.file.openFolder,
      messages.file.fileSavedAt(filePath),
      [
        { text: messages.file.cancel, style: 'cancel' },
        {
          text: messages.file.openFolderButton,
          onPress: async () => {
            // Try to open Downloads folder with content:// URI
            try {
              // If file is in app-specific folder, open Settings/Storage
              if (filePath.includes('/Android/data/')) {
                await Linking.openSettings();
              } else {
                // Try to open file manager with intent
                const intentUri = 'content://com.android.externalstorage.documents/document/primary:Download';
                await Linking.openURL(intentUri).catch(() => {
                  // Fallback to generic file manager
                  Linking.openURL('content://com.android.documentsui.documents/');
                });
              }
            } catch (e) {
              console.error('Could not open file manager:', e);
              Alert.alert(messages.alert.notice, messages.file.noticeOpenFileManager);
            }
          }
        }
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error opening file manager:', error);
    return false;
  }
}

/**
 * Open file on iOS
 */
async function openFileIOS(filePath: string): Promise<boolean> {
  try {
    // iOS: Try to share/preview file
    const Share = require('react-native').Share;
    
    await Share.share({
      url: `file://${filePath}`,
      title: 'Open File'
    });
    
    return true;
  } catch (error) {
    console.error('Error opening file on iOS:', error);
    
    const messages = getMessages();
    Alert.alert(
      messages.alert.notice,
      messages.file.noticeIOS(filePath)
    );
    
    return false;
  }
}

/**
 * Determine MIME type from extension
 */
function getMimeType(filePath: string): string {
  const extension = filePath.toLowerCase().split('.').pop() || '';
  
  const mimeTypes: { [key: string]: string } = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    
    // Video
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Others
    'apk': 'application/vnd.android.package-archive',
    'json': 'application/json',
    'xml': 'application/xml',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}
