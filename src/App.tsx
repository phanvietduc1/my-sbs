
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Alert, Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import Home from './Home';
import {OneSignal, LogLevel} from 'react-native-onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateModal from './components/UpdateModal';
import useVersionChecker from './hooks/useVersionChecker';
import { loadLocale } from './utils/localeManager';
import { getMessages } from './constants/Messages';
type TabParamList = {
  Home: { resetToHome?: boolean; reloadUrl?: boolean; newUrl?: string; currentUrl?: string } | undefined;
};
// Create a bottom tab navigator with our defined parameter list
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * TabBarIcon component - Renders the appropriate icon for each tab
 * @param route - The current route object
 * @param color - The color to apply to the icon (active/inactive state)
 * @param size - The size of the icon
 * @returns An Ionicons component with the correct icon for the tab
 */



const TabBarIcon: React.FC<{ route: any; color: string; size: number }> = ({
  route,
  color,
  size,
}) => {
  let iconName: string = 'home';
  if (route.name === 'Home') {
    iconName = 'home-outline';
  }
  return <Ionicons name={iconName} size={size} color={color} />;
};


const TabNavigator: React.FC = () => {
  const lastBackPressTime = useRef<number>(0);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(Config.WEBVIEW_URL as string);
  const navigationRef = useRef<any>(null);

  const PROD_URL = Config.WEBVIEW_URL as string;
  const DEV_URL = Config.DEV_WEBVIEW_URL as string;
  const DEBUG_URL_KEY = '@debug_webview_url';

  useEffect(() => {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(Config.ONESIGNAL_APP_ID as string);
    OneSignal.Notifications.requestPermission(false);

    // Load saved locale
    loadLocale();
    
    // Load saved URL from AsyncStorage
    loadSavedUrl();
  }, []);

  const loadSavedUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(DEBUG_URL_KEY);
      if (savedUrl) {
        setCurrentUrl(savedUrl);
      }
    } catch (error) {
      console.error('Error loading saved URL:', error);
    }
  };


  const saveUrl = async (url: string) => {
    try {
      await AsyncStorage.setItem(DEBUG_URL_KEY, url);
      setCurrentUrl(url);
      setShowDebugModal(false);

      console.log('URL saved:', url);
      
      const messages = getMessages();
      const isProduction = url === PROD_URL;
      
      // Reload the app to apply new URL
      Alert.alert(
        messages.debug.urlChanged,
        messages.debug.urlChangedMessage(isProduction, url),
        [
          {
            text: messages.debug.ok,
            onPress: () => {
              // Navigate to Home with reload parameter
              if (navigationRef.current) {
                navigationRef.current.navigate('Home', { reloadUrl: true, newUrl: url });
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving URL:', error);
      const messages = getMessages();
      Alert.alert(messages.error.generic, messages.error.unableToSaveUrl);
    }
  };

  const handleLongPressHome = () => {
    setShowDebugModal(true);
  };

  // Auto-check app version on mount and ensure it runs
  useVersionChecker({ checkOnMount: true, checkOnForeground: false });

  return (
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon route={route} color={color} size={size} />
            ),
          })}
          screenListeners={({ navigation, route }) => ({
            tabPress: (e) => {
              // ✅ Check if currently on Home tab and clicking on Home tab
              if (route.name === 'Home') {
                // ✅ Prevent default navigation
                e.preventDefault();
                
                // ✅ Navigate with reset parameter
                navigation.navigate('Home', { resetToHome: true });
              }
            },
            tabLongPress: () => {
              // ✅ Long press to open debug modal
              if (route.name === 'Home') {
                handleLongPressHome();
              }
            },
          })}>
          <Tab.Screen 
            name="Home" 
            component={Home}
            initialParams={{ currentUrl }}
          />
        </Tab.Navigator>
        <Toast />
  <UpdateModal />

        {/* Debug Modal */}
        <Modal
          visible={showDebugModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowDebugModal(false)}
        >
          <Pressable 
            style={debugStyles.modalOverlay}
            onPress={() => setShowDebugModal(false)}
          >
            <View style={debugStyles.modalContent}>
              <Text style={debugStyles.modalTitle}>{getMessages().debug.modalTitle}</Text>
              
              <View style={debugStyles.urlInfo}>
                <Text style={debugStyles.infoLabel}>{getMessages().debug.urlCurrent}</Text>
                <Text style={debugStyles.infoValue} numberOfLines={2}>
                  {currentUrl || Config.WEBVIEW_URL}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  debugStyles.urlButton,
                  currentUrl === PROD_URL && debugStyles.selectedButton
                ]}
                onPress={() => saveUrl(PROD_URL)}
              >
                <View style={debugStyles.buttonContent}>
                  <Text style={debugStyles.urlButtonTitle}>{getMessages().debug.productionUrl}</Text>
                  <Text style={debugStyles.urlButtonUrl}>{PROD_URL}</Text>
                </View>
                {currentUrl === PROD_URL && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  debugStyles.urlButton,
                  currentUrl === DEV_URL && debugStyles.selectedButton
                ]}
                onPress={() => saveUrl(DEV_URL)}
              >
                <View style={debugStyles.buttonContent}>
                  <Text style={debugStyles.urlButtonTitle}>{getMessages().debug.developmentUrl}</Text>
                  <Text style={debugStyles.urlButtonUrl}>{DEV_URL}</Text>
                </View>
                {currentUrl === DEV_URL && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={debugStyles.cancelButton}
                onPress={() => setShowDebugModal(false)}
              >
                <Text style={debugStyles.cancelButtonText}>{getMessages().debug.cancel}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </NavigationContainer>
  );
};

const debugStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  urlInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    backgroundColor: 'white',
  },
  selectedButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  buttonContent: {
    flex: 1,
  },
  urlButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  urlButtonUrl: {
    fontSize: 13,
    color: '#666',
  },
  cancelButton: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});

export default TabNavigator;
