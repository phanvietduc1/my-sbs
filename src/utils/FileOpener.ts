import { Platform, Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';

export async function openFolder(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const canOpen = await openFolderAndroid(); 
      return canOpen;
    } else if (Platform.OS === 'ios') {
      return await openFolderIOS();
    }

    return false;
  } catch (error) {
    console.error('Error opening folder:', error);
    Alert.alert('Error', 'Cannot open folder: ' + (error as Error).message);
    return false;
  }
}

async function openFolderAndroid(): Promise<boolean> {
  try {
    const { FileOpenerModule } = NativeModules;
    
    if (!FileOpenerModule) {
      // Fallback: Try to open file manager
      console.warn('FileOpenerModule not available, using fallback');
      return false;
    }
    
    // Call native module to open the folder containing the file
    await FileOpenerModule.openDownloadsFolder();
    return true;
    
  } catch (error) {
    console.error('Error opening file location on Android:', error);
    
    // Fallback: Open file manager
    return false;
  }
}

async function openFolderIOS(): Promise<boolean> {
  try {
    const folderPath = RNFS.DocumentDirectoryPath;
    
    const exists = await RNFS.exists(folderPath);
    if (!exists) {
      Alert.alert('Error', 'Downloads folder not found');
      return false;
    }
    
    // iOS do not allow to open folder
    Alert.alert(
      'Downloads Location',
      `Your files are saved in the app's Documents folder.\n\nTo access them:\n1. Open the Files app\n2. Navigate to "On My iPhone"\n3. Find this app's folder`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error opening folder on iOS:', error);
    
    Alert.alert(
      'Error',
      'Cannot open Downloads folder. Please use the Files app to access your downloads.'
    );
    
    return false;
  }
}