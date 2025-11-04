import { useEffect, useState } from 'react';
import {
  getFirestore,
  doc as docRef,
  onSnapshot,
  getDoc,
} from '@react-native-firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

interface UseConversationInfoResult {
  otherUserName: string; 
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch the conversation doc and the "other" user's name, for a 1-on-1 chat.
 */
export function useConversationInfo(conversationId: string): UseConversationInfoResult {
  const { user } = useAuth();
  const [otherUserName, setOtherUserName] = useState('Unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    const db = getFirestore();
    const conversationDocRef = docRef(db, 'conversations', conversationId);

    const unsubscribe = onSnapshot(
      conversationDocRef,
      async (snap) => {
        try {
          if (!snap.exists) {
            setError('Conversation does not exist');
            setLoading(false);
            return;
          }

          const data = snap.data() || {};
          const participantIds: string[] = data.participantIds || [];

          const otherUid = participantIds.find((uid) => uid !== user?.uid);
          if (!otherUid) {
            setOtherUserName('Anonymous');
            setLoading(false);
            return;
          }

          const userDocRef = docRef(db, 'users', otherUid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists) {
            const userData = userDocSnap.data() || {};
            const name = userData.displayName || 'NoName';
            setOtherUserName(name);
          } else {
            setOtherUserName('Unknown User');
          }

          setLoading(false);
        } catch (err: any) {
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, user]);

  return { otherUserName, loading, error };
}
