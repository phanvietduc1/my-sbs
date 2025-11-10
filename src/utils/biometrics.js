import { Alert, Platform } from 'react-native';
import TouchID from 'react-native-touch-id';
import { getMessages } from '../constants/Messages';

export function getDefaultBiometricConfig() {
  const messages = getMessages();
  return {
    title: messages.biometric.loginWithFingerprint,
    imageColor: '#e00606',
    imageErrorColor: '#ff0000',
    sensorDescription: messages.biometric.touchFingerprint,
    sensorErrorDescription: messages.biometric.authenticationFailedDesc,
    cancelText: messages.biometric.cancel,
  };
}

// Export default config for backward compatibility (will be created lazily)
export const defaultBiometricConfig = getDefaultBiometricConfig();

export async function isBiometricAvailable() {
  try {
    const biometryType = await TouchID.isSupported();
    return !!biometryType;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(
  reason = 'Authenticate',
  config = defaultBiometricConfig
) {
  try {
    await TouchID.authenticate(reason, config);
    return { success: true };
  } catch (err) {
    const code = err?.code || err?.name || 'E_BIOMETRIC_UNKNOWN';
    const message = err?.message || 'Biometric authentication failed';
    return { success: false, error: message, code };
  }
}

export async function ensureBiometricAuth(
  reason = 'Authenticate to proceed',
  config = defaultBiometricConfig,
  showAlerts = true
) {
  const messages = getMessages();
  const available = await isBiometricAvailable();
  if (!available) {
    if (showAlerts) {
      Alert.alert(
        messages.biometric.unavailable,
        Platform.OS === 'ios'
          ? messages.biometric.unavailableIOS
          : messages.biometric.unavailableAndroid
      );
    }
    return false;
  }

  const result = await authenticateWithBiometrics(reason, config);
  if (!result.success && showAlerts) {
    const msg =
      result.code === 'AUTHENTICATION_CANCELED'
        ? messages.biometric.authenticationCanceled
        : result.code === 'USER_CANCELED'
        ? messages.biometric.userCanceled
        : result.error || messages.biometric.authenticationFailedGeneric;
    Alert.alert(messages.biometric.authenticationFailed, msg);
  }
  return result.success;
}
