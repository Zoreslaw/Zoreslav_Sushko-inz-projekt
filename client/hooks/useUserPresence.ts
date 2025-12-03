import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';

export function useUserPresence(uid: string | null) {
  const [isOnline, setIsOnline] = useState(false);
  const appState = useRef(AppState.currentState);
  const { user } = useAuth();
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchPresence = useCallback(async () => {
    if (!uid) {
      setIsOnline(false);
      return;
    }

    try {
      const presence = await api.getPresence(uid);
      setIsOnline(presence.isOnline);
    } catch (err) {
      console.error('Error fetching presence:', err);
      setIsOnline(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!user || !uid) return;

    // Initial fetch
    fetchPresence();

    // Poll for presence updates every 10 seconds
    pollInterval.current = setInterval(fetchPresence, 10000);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - update our presence and fetch other user's presence
        await api.setPresence(true).catch(console.error);
        fetchPresence();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - update our presence
        await api.setPresence(false).catch(console.error);
      }

      appState.current = nextAppState;
    });

    // Set ourselves as online initially
    api.setPresence(true).catch(console.error);

    return () => {
      subscription.remove();
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [uid, user, fetchPresence]);

  return isOnline;
}

