import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppState } from 'react-native';
import { checkAppVersion } from '../store/appVersionSlice';

/**
 * Hook to auto-check app version
 * 
 * @param {Object} options
 * @param {boolean} options.checkOnMount - Check when mounted (default: true)
 * @param {boolean} options.checkOnForeground - Check when app comes to foreground (default: false)
 */
const useVersionChecker = ({ 
  checkOnMount = true, 
  checkOnForeground = false 
} = {}) => {
  const dispatch = useDispatch();

  // Check when mounted
  useEffect(() => {
    if (checkOnMount) {
      console.log('🔍 [useVersionChecker] App mounted - Checking app version...');
      dispatch(checkAppVersion());
    }
  }, [checkOnMount, dispatch]);

  // Check when app comes to foreground
  useEffect(() => {
    if (!checkOnForeground) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔍 App became active - Checking version...');
        dispatch(checkAppVersion());
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [checkOnForeground, dispatch]);
};

export default useVersionChecker;
