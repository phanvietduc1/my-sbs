import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale, Locale } from '../constants/Messages';

const LOCALE_STORAGE_KEY = '@app_locale';

export async function loadLocale(): Promise<Locale> {
  try {
    const savedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale === 'ko' || savedLocale === 'en') {
      setLocale(savedLocale);
      return savedLocale;
    }
  } catch (error) {
    console.error('Error loading locale:', error);
  }
  // Default to Korean
  setLocale('ko');
  return 'ko';
}

export async function saveLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    setLocale(locale);
  } catch (error) {
    console.error('Error saving locale:', error);
  }
}

export async function getStoredLocale(): Promise<Locale | null> {
  try {
    const savedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale === 'ko' || savedLocale === 'en') {
      return savedLocale;
    }
  } catch (error) {
    console.error('Error getting locale:', error);
  }
  return null;
}

