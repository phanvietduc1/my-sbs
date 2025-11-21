import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { NotificationManager } from './NotificationManager';
import { PERMISSIONS, check, request, RESULTS } from 'react-native-permissions';
import { Buffer } from 'buffer';
import { NativeModules } from 'react-native';
const { DownloadModule } = NativeModules;

interface DownloadHeaders {
  [key: string]: string;
}

interface SingleDownloadOptions {
  url: string;
  headers?: DownloadHeaders;
}

interface MultipleDownloadOptions {
  fileIdList: number[];
  headers?: DownloadHeaders;
  apiUrl?: string;
}

class DownloadQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent = 2; 

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const task = this.queue.shift();
    
    if (task) {
      try {
        await task();
      } finally {
        this.activeCount--;
        this.process(); // Process next task
      }
    }
  }
}

const downloadQueue = new DownloadQueue();

/**
 * Request storage permission for downloading files
 * - Android API <= 28: Requires WRITE_EXTERNAL_STORAGE
 * - Android API >= 29: No permission needed for app-specific directory
 * - iOS: No permission needed for Documents directory
 */
async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const apiLevel = parseInt(Platform.Version.toString(), 10);
    
    // Android 10+ (API 29+) doesn't need permission for app-specific directory
    if (apiLevel >= 29) {
      return true;
    }
    
    // Android 9 and below need WRITE_EXTERNAL_STORAGE
    try {
      const result = await check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
      
      if (result === RESULTS.GRANTED) {
        return true;
      }
      
      if (result === RESULTS.DENIED) {
        const requestResult = await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        return requestResult === RESULTS.GRANTED;
      }
      
      if (result === RESULTS.BLOCKED) {
        Alert.alert(
          'Permission Required',
          'Storage permission is required to download files. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }
      
      return false;
    } catch (err) {
      console.warn('Storage permission request error:', err);
      return false;
    }
  }
  
  // iOS doesn't need permission for Documents directory
  return true;
}

async function getDownloadBaseDir(): Promise<string> {
  if (Platform.OS === 'android') {
    const apiLevel = parseInt(Platform.Version.toString(), 10);
    if (apiLevel <= 28) {
      // Pre-Android 10: public Downloads
      return RNFS.DownloadDirectoryPath;
    } else {
      // Android 10+: app-specific external directory
      const appDir = `${RNFS.ExternalDirectoryPath}/downloads`;
      const exists = await RNFS.exists(appDir);
      if (!exists) {
        await RNFS.mkdir(appDir);
      }
      return appDir;
    }
  } else {
    // iOS: Documents directory (persistent storage)
    // DocumentDirectoryPath always exists on iOS, but we check to be safe
    const docDir = RNFS.DocumentDirectoryPath;
    try {
      const exists = await RNFS.exists(docDir);
      if (!exists) {
        console.log('📁 Creating Documents directory...');
        await RNFS.mkdir(docDir);
      }
    } catch (error) {
      // If directory check fails, it might still exist - continue anyway
      console.warn('⚠️ Could not verify Documents directory existence:', error);
    }
    return docDir;
  }
}

async function getUniqueDownloadPath(filename: string): Promise<string> {
  const baseDir = await getDownloadBaseDir();

  const extIndex = filename.lastIndexOf('.');
  const name = extIndex > -1 ? filename.slice(0, extIndex) : filename;
  const ext = extIndex > -1 ? filename.slice(extIndex) : '';

  let filePath = `${baseDir}/${filename}`;
  let counter = 1;

  while (await RNFS.exists(filePath)) {
    filePath = `${baseDir}/${name}(${counter})${ext}`;
    counter++;
  }

  return filePath;
}

/**
 * Extract filename from Content-Disposition header ( UTF-8 and Korean)
 */
function extractFilenameFromHeader(contentDisposition: string): string {
  console.log('📄 Content-Disposition:', contentDisposition);

  // Try filename* first (RFC 5987 - UTF-8 encoded)
  const filenameStarMatch = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (filenameStarMatch && filenameStarMatch[1]) {
    try {
      const decoded = decodeURIComponent(filenameStarMatch[1].replace(/['"]/g, '').trim());
      console.log('✅ Extracted UTF-8 filename from filename*:', decoded);
      return decoded;
    } catch (e) {
      console.warn('Failed to decode UTF-8 filename:', e);
      return filenameStarMatch[1].replace(/['"]/g, '').trim();
    }
  }

  // Fallback to filename
  const filenameMatch = contentDisposition.match(/filename=["']?([^;"'\n]+)["']?/i);
  if (filenameMatch && filenameMatch[1]) {
    const rawFilename = filenameMatch[1].trim();
    try {
      // Try to decode if it's URL-encoded
      const decoded = decodeURIComponent(rawFilename);
      console.log('✅ Extracted filename from filename:', decoded);
      return decoded;
    } catch (e) {
      return rawFilename;
    }
  }

  return '';
}

function generateFallbackFilename(url: string, defaultExtension: string = 'pdf'): string {
  const timestamp = Date.now();
  const urlPath = url.split('?')[0];
  const urlFilename = urlPath.split('/').pop() || '';

  if (urlFilename && urlFilename.includes('.')) {
    return `${urlFilename}_${timestamp}`;
  } else {
    return `download_${timestamp}.${defaultExtension}`;
  }
}

// Internal implementation
async function _downloadSingleFile(options: SingleDownloadOptions): Promise<void> {
  const { url, headers = {} } = options;

  const notificationId = NotificationManager.createDownloadSession();

  if (!url || typeof url !== 'string') {
    console.error('❌ Invalid download URL:', url);
    await NotificationManager.showError('download', 'Invalid download URL', notificationId);
    throw new Error('Invalid download URL');
  }

  // Check storage permission
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    console.error('❌ Storage permission denied');
    await NotificationManager.showError('download', 'Storage permission is required to download files', notificationId);
    throw new Error('Storage permission denied');
  }

  console.log('🌐 Downloading from API URL:', url);

  try {
    let finalFilename = '';

    // Try to get filename from HEAD request
    try {
      console.log('📡 Sending HEAD request to get file metadata...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const headResponse = await fetch(url, { method: 'HEAD', headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (headResponse.ok) {
        const contentDisposition = headResponse.headers.get('content-disposition');
        if (contentDisposition) finalFilename = extractFilenameFromHeader(contentDisposition);
      } else {
        console.warn('⚠️ HEAD request failed with status:', headResponse.status);
      }
    } catch (headError: any) {
      if (headError.name === 'AbortError') console.warn('⚠️ HEAD request timeout, using fallback filename');
      else console.warn('⚠️ HEAD request failed:', headError.message);
    }

    if (!finalFilename || finalFilename.trim() === '') {
      finalFilename = generateFallbackFilename(url);
      console.log('⚠️ Using fallback filename:', finalFilename);
    }

    await NotificationManager.showPreparing(finalFilename, undefined, undefined, notificationId);

    console.log('📁 Final filename:', finalFilename);

    if (Platform.OS === 'android') {
      console.log('⬇️ Downloading file via fetch for Android MediaStore...');
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Download failed`);

      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = res.headers.get('content-type') || 'application/octet-stream';

      const savedUri = await DownloadModule.saveToDownloads(base64, finalFilename, mimeType);
      console.log('✅ File saved to Downloads:', savedUri);

      await NotificationManager.showSuccess(finalFilename, "/Downloads", notificationId);
    } else {
      // iOS: Use fetch + writeFile to ensure directory exists and handle errors better
      // getUniqueDownloadPath already ensures directory exists via getDownloadBaseDir
      const downloadDest = await getUniqueDownloadPath(finalFilename);
      console.log('⬇️ Downloading to:', downloadDest);

      // Download using fetch and writeFile (more reliable on iOS)
      console.log('📡 Fetching file data...');
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Download failed`);

      console.log('📝 Converting to base64...');
      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      // Write file to disk
      console.log('💾 Writing file to disk...');
      await RNFS.writeFile(downloadDest, base64Data, 'base64');

      // Verify file was created
      const fileExists = await RNFS.exists(downloadDest);
      if (!fileExists) {
        throw new Error('File was not created');
      }

      const fileStats = await RNFS.stat(downloadDest);
      console.log(`✅ File downloaded successfully:`, fileStats.size, 'bytes');

      await NotificationManager.showSuccess(finalFilename, downloadDest, notificationId);
    }

  } catch (error: any) {
    console.error('❌ Download from API failed:', error);
    await NotificationManager.showError('download', error.message || 'Download failed', notificationId);
    throw error;
  }
}

async function _downloadMultipleFiles(options: MultipleDownloadOptions): Promise<void> {
  const { fileIdList, headers = {}, apiUrl } = options;

  const notificationId = NotificationManager.createDownloadSession();

  if (!fileIdList || !Array.isArray(fileIdList) || fileIdList.length === 0) {
    console.error('❌ Invalid fileIdList:', fileIdList);
    await NotificationManager.showError('download', 'Invalid file list', notificationId);
    throw new Error('Invalid file list');
  }

  // Check storage permission
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    console.error('❌ Storage permission denied');
    await NotificationManager.showError('download', 'Storage permission is required to download files', notificationId);
    throw new Error('Storage permission denied');
  }

  const downloadApiUrl = apiUrl || 'http://192.168.1.7:9000/api/attachment-file/download-all';
  console.log('🌐 Downloading multiple files from API:', downloadApiUrl);
  console.log('📋 File IDs:', fileIdList);

  try {
    // Show preparing notification
    const fileCount = fileIdList.length;
    const preparingMessage = `Preparing ${fileCount} file${fileCount > 1 ? 's' : ''} (ZIP)`;
    try {
      await NotificationManager.showPreparing(preparingMessage, undefined, undefined, notificationId);
    } catch (e) {
      console.error('Failed to show preparing notification:', e);
    }

    // Make POST request
    console.log('📡 Sending POST request to download-all API...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for multiple files

    const response = await fetch(downloadApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ fileIdList }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Download request failed`);
    }

    // Extract filename from Content-Disposition (Korean filename support)
    let finalFilename = '';
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      finalFilename = extractFilenameFromHeader(contentDisposition);
    }

    // Fallback filename if not extracted from headers
    if (!finalFilename || finalFilename.trim() === '') {
      const timestamp = Date.now();
      finalFilename = `downloads_${fileCount}files_${timestamp}.zip`;
      console.log('⚠️ Using fallback filename:', finalFilename);
    }

    // Ensure filename has .zip extension
    if (!finalFilename.toLowerCase().endsWith('.zip')) {
      finalFilename += '.zip';
      console.log('✅ Added .zip extension to filename');
    }

    console.log('📁 Final filename:', finalFilename);

    // Download the file using fetch (since we need POST with body)
    console.log('📡 Fetching file data...');
    
    const arrayBuffer = await response.arrayBuffer();
    
    console.log('📝 Converting to base64...');
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    if (Platform.OS === 'android') {
      const mimeType = response.headers.get('content-type') || 'application/zip';
      const savedUri = await DownloadModule.saveToDownloads(base64Data, finalFilename, mimeType);
      console.log(`✅ ZIP file (${fileCount} files) saved to Downloads:`, savedUri);

      await NotificationManager.showSuccess(finalFilename, "/Downloads", notificationId);
    } else {
      const downloadDest = await getUniqueDownloadPath(finalFilename);
      console.log('⬇️ Downloading to:', downloadDest);

      // Write file to disk
      console.log('💾 Writing file to disk...');
      await RNFS.writeFile(downloadDest, base64Data, 'base64');

      // Verify file was created
      const fileExists = await RNFS.exists(downloadDest);
      if (!fileExists) {
        throw new Error('File was not created');
      }

      const fileStats = await RNFS.stat(downloadDest);
      console.log(`✅ ZIP file (${fileCount} files) downloaded successfully:`, fileStats.size, 'bytes');

      await NotificationManager.showSuccess(finalFilename, downloadDest, notificationId);
    }
  } catch (error: any) {
    console.error('❌ Multiple files download failed:', error);
    await NotificationManager.showError('download', error.message || 'Multiple files download failed', notificationId);
    throw error;
  }
}

export const DownloadManager = {
  async downloadSingleFile(options: SingleDownloadOptions): Promise<void> {
    return downloadQueue.add(() => _downloadSingleFile(options));
  },

  async downloadMultipleFiles(options: MultipleDownloadOptions): Promise<void> {
    return downloadQueue.add(() => _downloadMultipleFiles(options));
  }
};

