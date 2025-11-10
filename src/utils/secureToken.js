import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const serviceName = (userId) => `refresh-token:${userId}`;

export async function saveRefreshToken(userId, refreshToken) {
  try {
    await Keychain.setGenericPassword(
      userId,
      refreshToken,
      {
        service: serviceName(userId),
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        accessControl:
          Platform.OS === 'ios'
            ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
            : Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      }
    );
    return true;
  } catch (e) {
    return false;
  }
}

export async function getRefreshToken(userId) {
  try {
    const res = await Keychain.getGenericPassword({
      service: serviceName(userId),
      authenticationPrompt: {
        title: 'Authenticate to access token',
        subtitle: 'Biometric authentication',
        description: 'Use biometrics to access your saved login',
        cancel: 'Cancel',
      },
    });
    if (res) {
      return res.password;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function deleteRefreshToken(userId) {
  try {
    return await Keychain.resetGenericPassword({ service: serviceName(userId) });
  } catch (e) {
    return false;
  }
}
