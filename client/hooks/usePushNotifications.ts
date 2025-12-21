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

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== 'granted') {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('Expo projectId is missing. Push token registration skipped.');
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    if (!token) return;

    await api.registerDeviceToken(token, Platform.OS);
    await setStoredPushToken(token);
    setPushToken(token);
  }, [enabled]);

  const unregisterPushToken = useCallback(async () => {
    const storedToken = pushToken ?? (await getStoredPushToken());
    if (!storedToken) return;

    await api.unregisterDeviceToken(storedToken);
    await clearStoredPushToken();
    setPushToken(null);
  }, [pushToken]);

  useEffect(() => {
    registerForPushNotifications().catch((err) =>
      console.error('Push registration error:', err)
    );
  }, [registerForPushNotifications]);

  return { pushToken, unregisterPushToken };
}
