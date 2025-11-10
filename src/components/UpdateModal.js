import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectHasUpdate,
  selectUpdateInfo,
  dismissUpdate,
} from '../store/appVersionSlice';
import { openDownloadLink } from '../utils/UpdateManager';
import { getMessages } from '../constants/Messages';

const UpdateModal = () => {
  const dispatch = useDispatch();
  const hasUpdate = useSelector(selectHasUpdate);
  const updateInfo = useSelector(selectUpdateInfo);

  if (!hasUpdate || !updateInfo) {
    return null;
  }

  const handleUpdate = () => {
    openDownloadLink(updateInfo, dispatch);
  };

  const handleLater = () => {
    dispatch(dismissUpdate());
  };

  const messages = getMessages();

  return (
    <Modal
      visible={hasUpdate}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🎉</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{messages.update.title}</Text>

          {/* Version info */}
          <Text style={styles.versionText}>
            {messages.update.versionAvailable(updateInfo.newVersion)}
          </Text>
          <Text style={styles.currentVersion}>
            {messages.update.currentVersion(updateInfo.oldVersion)}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.laterButton]}
              onPress={handleLater}
            >
              <Text style={styles.laterText}>{messages.update.later}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateText}>{messages.update.updateNow}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#4a4a4a',
    marginBottom: 4,
  },
  currentVersion: {
    fontSize: 14,
    textAlign: 'center',
    color: '#8a8a8a',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButton: {
    backgroundColor: '#f0f0f0',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  laterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  updateText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default UpdateModal;
