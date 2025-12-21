import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '@/services/api';
import { clearStoredPushToken, getStoredPushToken, setStoredPushToken } from '@/utils/pushTokenStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(enabled: boolean) {
  const [pushToken, setPushToken] = useState<string | null>(null);

  const registerForPushNotifications = useCallback(async () => {
    if (!enabled) return;

    // Skip Android push notifications - requires Firebase/FCM setup
    // Even though we use Expo's push service, Android still needs FCM configured
    if (Platform.OS === 'android') {
      console.warn('Push notifications are disabled on Android. Firebase/FCM setup required for Android push notifications.');
      return;
    }

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== 'granted') {
      return;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('Expo projectId is missing. Push token registration skipped.');
      return;
    }

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;

      if (!token) return;

      await api.registerDeviceToken(token, Platform.OS);
      await setStoredPushToken(token);
      setPushToken(token);
    } catch (error: any) {
      // Handle any push notification errors gracefully
      if (error?.message?.includes('Firebase') || error?.message?.includes('FCM')) {
        console.warn('Push notifications unavailable: Firebase/FCM not configured.');
      } else {
        console.error('Push registration error:', error);
      }
    }
  }, [enabled]);

  const unregisterPushToken = useCallback(async () => {
    const storedToken = pushToken ?? (await getStoredPushToken());
    if (!storedToken) return;

    await api.unregisterDeviceToken(storedToken);
    await clearStoredPushToken();
    setPushToken(null);
  }, [pushToken]);

  useEffect(() => {
    registerForPushNotifications();
  }, [registerForPushNotifications]);

  return { pushToken, unregisterPushToken };
}
