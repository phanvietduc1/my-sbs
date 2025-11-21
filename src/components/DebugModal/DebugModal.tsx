import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, Alert, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

interface DebugModalProps {
  visible: boolean;
  onClose: () => void;
  onUrlChanged?: (newUrl: string) => void;
}

const DebugModal: React.FC<DebugModalProps> = ({ visible, onClose, onUrlChanged }) => {
  const [currentUrl, setCurrentUrl] = useState<string>(Config.WEBVIEW_URL as string);

  const PROD_URL = Config.WEBVIEW_URL as string;
  const DEV_URL = Config.DEV_WEBVIEW_URL as string;
  const DEBUG_URL_KEY = '@debug_webview_url';

  useEffect(() => {
    if (visible) {
      loadSavedUrl();
    }
  }, [visible]);

  const loadSavedUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(DEBUG_URL_KEY);
      if (savedUrl) {
        setCurrentUrl(savedUrl);
      } else {
        setCurrentUrl(PROD_URL);
      }
    } catch (error) {
      console.error('Error loading saved URL:', error);
    }
  };

  const saveUrl = async (url: string) => {
    try {
      await AsyncStorage.setItem(DEBUG_URL_KEY, url);
      setCurrentUrl(url);
      onClose();

      console.log('URL saved:', url);
      
      Alert.alert(
        'URL Changed',
        `The URL has been changed to: ${url === PROD_URL ? 'Production' : 'Development'}\nThe app will reload to apply the change.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onUrlChanged) {
                onUrlChanged(url);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving URL:', error);
      Alert.alert('Error', 'Unable to save URL');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <Pressable 
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()} // Prevent close when clicking inside
        >
          <Text style={styles.modalTitle}>🔧 Debug: Switch URL</Text>
          
          <View style={styles.urlInfo}>
            <Text style={styles.infoLabel}>Current URL:</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {currentUrl || PROD_URL}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.urlButton,
              currentUrl === PROD_URL && styles.selectedButton
            ]}
            onPress={() => saveUrl(PROD_URL)}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.urlButtonTitle}>Production URL</Text>
              <Text style={styles.urlButtonUrl}>{PROD_URL}</Text>
            </View>
            {currentUrl === PROD_URL && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.urlButton,
              currentUrl === DEV_URL && styles.selectedButton
            ]}
            onPress={() => saveUrl(DEV_URL)}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.urlButtonTitle}>Development URL</Text>
              <Text style={styles.urlButtonUrl}>{DEV_URL}</Text>
            </View>
            {currentUrl === DEV_URL && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
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

export default DebugModal;
