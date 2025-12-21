import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

export default function NotificationListener() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      const conversationId = data?.conversationId;
      if (conversationId) {
        router.push(`/conversation/${conversationId}`);
      }
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}
