import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_VERSION_KEY = '@app_saved_version';

const initialState = {
  data: null,
  loading: false,
  error: null,
  hasUpdate: false,           // Whether there's a new update
  updateInfo: null,           // Update information { version, downloadUrl }
};

// Async thunk to check version
export const checkAppVersion = createAsyncThunk(
  'appVersion/check',
  async (_, { rejectWithValue }) => {
    try {
      // 1. Fetch manifest from server
      const response = await fetch('https://nrsm.sbs.co.kr/mobile/applist.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📡 [checkAppVersion] API Response:', JSON.stringify(data, null, 2));
      
      // 2. Get version by platform (beta version)
      // Use nrsm_obt_and for Android and nrsm_obt_ios for iOS
      const platform = Platform.OS === 'android' ? 'nrsm_obt_and' : 'nrsm_obt_ios';
      const serverInfo = data[platform];
      
      if (!serverInfo) {
        throw new Error(`Platform ${platform} not found in server response`);
      }
      
      const serverVersion = serverInfo.version;
      
      // 3. Get saved version
      const savedVersion = await AsyncStorage.getItem(SAVED_VERSION_KEY);
      
      console.log('📱 Platform:', platform);
      console.log('📱 Saved version:', savedVersion || 'None (first install)');
      console.log('☁️  Server version:', serverVersion);
      
      // 4. If first time installing app → Save server version as baseline
        if (!savedVersion) {
        console.log('🆕 First install - Saving server version as baseline');
        console.log('📦 Server info:', serverInfo);
        console.log('🔢 Server version from API:', serverVersion);
        
        // Save server version as baseline for next time
        await AsyncStorage.setItem(SAVED_VERSION_KEY, serverVersion);
        console.log('✅ [First install] Saved baseline version:', serverVersion);
        
        return {
          data,
          hasUpdate: false,
          updateInfo: null,
        };
      }
      
      // 5. Compare versions (only runs when saved version exists)
      const hasUpdate = savedVersion !== serverVersion;
      
      console.log('🔍 Version comparison:');
      console.log('  - Saved version:', savedVersion);
      console.log('  - Server version:', serverVersion);
      console.log('  - Has update:', hasUpdate);
      
      if (hasUpdate) {
        console.log('🎉 New version available!');
        
        // Build download URL
        // Android: https://nrsm.sbs.co.kr/mobile/app/nrsMOBT.apk
        // iOS: https://nrsm.sbs.co.kr/mobile/app/nrsMOBT.plist (wrapped in itms-services://)
        let downloadUrl;
        if (Platform.OS === 'ios') {
          // iOS Enterprise Distribution - plist URL
          const plistUrl = `https://nrsm.sbs.co.kr/mobile/app/${serverInfo.filename}`;
          downloadUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
          console.log('📱 iOS plist URL:', plistUrl);
        } else {
          // Android APK direct download
          downloadUrl = `https://nrsm.sbs.co.kr/mobile/app/${serverInfo.filename}`;
        }
        
        console.log('📥 Download URL:', downloadUrl);
        
        return {
          data,
          hasUpdate: true,
          updateInfo: {
            oldVersion: savedVersion,
            newVersion: serverVersion,
            downloadUrl,
            filename: serverInfo.filename,
            path: serverInfo.path,
          },
        };
      }
      
      console.log('✅ App is up to date');
      return {
        data,
        hasUpdate: false,
        updateInfo: null,
      };
      
    } catch (error) {
      console.error('❌ Error checking version:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Action to update version after user finishes installation
export const updateSavedVersion = createAsyncThunk(
  'appVersion/updateSaved',
  async (newVersion) => {
    console.log('💾 [updateSavedVersion] Saving version:', newVersion);
    await AsyncStorage.setItem(SAVED_VERSION_KEY, newVersion);
    console.log('✅ [updateSavedVersion] Successfully saved version:', newVersion);
    return newVersion;
  }
);

// Action to clear saved version (to reset to first install)
export const clearSavedVersion = createAsyncThunk(
  'appVersion/clearSaved',
  async () => {
    console.log('🗑️ [clearSavedVersion] Clearing saved version...');
    await AsyncStorage.removeItem(SAVED_VERSION_KEY);
    console.log('✅ [clearSavedVersion] Saved version cleared');
    return null;
  }
);

// Slice
const appVersionSlice = createSlice({
  name: 'appVersion',
  initialState,
  reducers: {
    dismissUpdate: (state) => {
      state.hasUpdate = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Check version - pending
      .addCase(checkAppVersion.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // Check version - fulfilled
      .addCase(checkAppVersion.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.data;
        state.hasUpdate = action.payload.hasUpdate;
        state.updateInfo = action.payload.updateInfo;
        state.error = null;
      })
      // Check version - rejected
      .addCase(checkAppVersion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update saved version
      .addCase(updateSavedVersion.fulfilled, (state) => {
        state.hasUpdate = false;
        state.updateInfo = null;
      })
      // Clear saved version
      .addCase(clearSavedVersion.fulfilled, (state) => {
        state.hasUpdate = false;
        state.updateInfo = null;
      });
  },
});

// Actions
export const { dismissUpdate, clearError } = appVersionSlice.actions;

// Selectors
export const selectHasUpdate = (state) => state.appVersion.hasUpdate;
export const selectUpdateInfo = (state) => state.appVersion.updateInfo;
export const selectLoading = (state) => state.appVersion.loading;
export const selectError = (state) => state.appVersion.error;

export default appVersionSlice.reducer;
