import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getDatabase, ref, set, onValue } from '@react-native-firebase/database';
import database from '@react-native-firebase/database';
import { useAuth } from '@/hooks/useAuth';

export function useUserPresence(uid: string | null) {
  const [isOnline, setIsOnline] = useState(false);
  const appState = useRef(AppState.currentState);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const db = getDatabase();
    const statusRef = ref(db, `/status/${user.uid}`);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        set(statusRef, true);
      } else if (nextAppState.match(/inactive|background/)) {
        set(statusRef, false);
      }

      appState.current = nextAppState;
    });

    const otherUserRef = ref(db, `/status/${uid}`);
    const listener = onValue(otherUserRef, (snapshot) => {
      const status = snapshot.val();
      setIsOnline(status === true);
    });

    if (AppState.currentState === 'active') {
      set(statusRef, true);
    } else {
      set(statusRef, false);
    }

    return () => {
      subscription.remove();
      database().ref(`/status/${uid}`).off('value', listener);
    };
  }, [uid, user]);

  return isOnline;
}
