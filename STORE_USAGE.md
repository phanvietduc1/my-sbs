# App Version Store - Redux Toolkit

## 📦 Installation

The store has been pre-configured, you just need to wrap the app with Provider.

## 🚀 Usage

### 1. Setup Store in App

In `App.tsx` or `index.js` file:

```javascript
import React from 'react';
import { Provider } from 'react-redux';
import store from './src/store/store';
import YourApp from './src/YourApp';

const App = () => {
  return (
    <Provider store={store}>
      <YourApp />
    </Provider>
  );
};

export default App;
```

### 2. Use in Component

```javascript
import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchAppVersion,
  selectAppVersionData,
  selectAppVersionLoading,
  selectAppVersionError,
  selectVersionByPlatform,
} from './store/appVersionSlice';

const MyComponent = () => {
  const dispatch = useDispatch();
  
  // Get data
  const data = useSelector(selectAppVersionData);
  const loading = useSelector(selectAppVersionLoading);
  const error = useSelector(selectAppVersionError);
  
  // Get version by platform
  const androidVersion = useSelector(selectVersionByPlatform('android', false));
  const iosVersion = useSelector(selectVersionByPlatform('ios', false));
  
  // Fetch when component mounts
  useEffect(() => {
    dispatch(fetchAppVersion());
  }, []);

  const handleRefresh = () => {
    dispatch(fetchAppVersion());
  };

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Text>Android Version: {androidVersion?.version}</Text>
      <Text>iOS Version: {iosVersion?.version}</Text>
      <Button title="Refresh" onPress={handleRefresh} />
    </View>
  );
};
```

### 3. Available Actions

```javascript
import { 
  fetchAppVersion,      // Fetch data from API
  clearAppVersion,      // Clear data
  clearError,           // Clear error
} from './store/appVersionSlice';

// Dispatch actions
dispatch(fetchAppVersion());
dispatch(clearAppVersion());
dispatch(clearError());
```

### 4. Available Selectors

```javascript
import {
  selectAppVersionData,      // Get all data
  selectAppVersionLoading,   // Get loading state
  selectAppVersionError,     // Get error message
  selectLastFetched,         // Get last fetch timestamp
  selectVersionByPlatform,   // Get version by platform
} from './store/appVersionSlice';

// Usage
const data = useSelector(selectAppVersionData);
const loading = useSelector(selectAppVersionLoading);
const error = useSelector(selectAppVersionError);
const androidVersion = useSelector(selectVersionByPlatform('android', false));
const androidOBT = useSelector(selectVersionByPlatform('android', true));
```

## 📊 Data Structure

Response from API:

```javascript
{
  nrsm_and: {
    version: "1.4",
    filename: "nrsM.apk",
    path: "/mobile/app/",
    duration: 192,
    durationVip: 720,
    durationVipMember: "S921060,S910998,..."
  },
  nrsm_ios: {
    version: "1.7",
    filename: "nrsM.plist",
    path: "/mobile/app/",
    duration: 192,
    durationVip: 720,
    durationVipMember: "S921060,S910998,..."
  },
  nrsm_obt_and: { ... },
  nrsm_obt_ios: { ... }
}
```

## 🎯 Features

- ✅ Fetch data from API
- ✅ Loading state
- ✅ Error handling
- ✅ Cache last fetched timestamp
- ✅ Selectors to get data by platform
- ✅ Clear data & error actions
- ✅ Redux DevTools support

## 📱 Platform Selection

```javascript
// Get version by current platform
const currentPlatform = Platform.OS === 'android' ? 'android' : 'ios';
const currentVersion = useSelector(selectVersionByPlatform(currentPlatform, false));

// Get OBT version
const obtVersion = useSelector(selectVersionByPlatform(currentPlatform, true));
```

## 🔄 Auto-refresh

If you want to auto-refresh every X minutes:

```javascript
useEffect(() => {
  // Fetch immediately when mounted
  dispatch(fetchAppVersion());
  
  // Refresh every 5 minutes
  const interval = setInterval(() => {
    dispatch(fetchAppVersion());
  }, 5 * 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

## 🧪 Testing

Component example has been created at: `src/components/AppVersionChecker.js`

Import and use:

```javascript
import AppVersionChecker from './components/AppVersionChecker';

// In app
<AppVersionChecker />
```

## 📝 Created Files

1. `src/store/appVersionSlice.js` - Main Redux slice
2. `src/store/store.js` - Store configuration
3. `src/components/AppVersionChecker.js` - Example component
4. `STORE_USAGE.md` - This guide file
