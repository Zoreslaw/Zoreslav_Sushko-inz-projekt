import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  doc as docRef,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
} from '@react-native-firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import User from '@/types/User';

export interface ChatItem {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadMessages: number;
  avatarUrl?: string;
  otherUserId: string;
}

interface UseConversationsResult {
  conversations: ChatItem[];
  loading: boolean;
  error: string | null;
}

export function useConversations(): UseConversationsResult {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no user is signed in, skip
    if (!user) {
      setLoading(false);
      setConversations([]);
      return;
    }

    // 1) Get Firestore instance
    const db = getFirestore();

    // 2) Build a query for the 'conversations' collection
    // where participantIds contains the user’s UID
    // and order by lastUpdatedAt descending
    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(
      conversationsRef,
      where('participantIds', 'array-contains', user.uid),
      orderBy('lastUpdatedAt', 'desc')
    );

    // 3) Listen in real-time
    const unsubscribe = onSnapshot(
      conversationsQuery,
      async (snapshot) => {
        try {
          // Map each conversation doc into ChatItem
          const items = await Promise.all(
            snapshot.docs.map(async (conversationDoc) => {
              const data = conversationDoc.data() || {};

              // Extract lastMessage info
              const lastMsg = data.lastMessage || {};
              const lastMessageText = lastMsg.message || '';
              let lastMessageTime = '';
              if (lastMsg.timestamp) {
                lastMessageTime = new Date(lastMsg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }

              // Build participant info
              // 'participants' is presumably an array of DocumentReference objects
              let otherUserName = 'Unknown';
              let otherUserAvatar: string | undefined;
              const participantRefs = data.participants || [];

              // Find the doc ref for the "other" user
              const otherRef = participantRefs.find((refObj: any) => refObj.id !== user.uid);
              let otherUserId: string | null = null;
              if (otherRef) {
                // Save the UID for presence lookup
                otherUserId = otherRef.id;
              
                // fetch user doc
                const userDocSnap = await getDoc(otherRef);
                const userData = userDocSnap.data() as User;
                if (userData) {
                  otherUserName = userData.displayName || 'Anonymous';
                  otherUserAvatar = userData.photoURL || undefined;
                }
              }
              
              // Calculate unread messages:
              // Count messages in the subcollection where senderId is not the current user
              // and status is "Sent"
              let unreadCount = 0;
              const messagesRef = collection(db, 'conversations', conversationDoc.id, 'messages');
              const unreadQuery = query(
                messagesRef,
                where('senderId', '!=', user.uid),
                where('status', '==', 'Sent')
              );
              const msgSnap = await getDocs(unreadQuery);
              unreadCount = msgSnap.size;

              return {
                id: conversationDoc.id,
                name: otherUserName,
                lastMessage: lastMessageText,
                lastMessageTime,
                unreadMessages: unreadCount,
                avatarUrl: otherUserAvatar,
                otherUserId: otherUserId || '',
              } as ChatItem;
            })
          );

          setConversations(items);
          setLoading(false);
        } catch (err: any) {
          console.error('Error fetching user docs or unread messages:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching conversations:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup on unmount
    return () => unsubscribe();
  }, [user]);

  return { conversations, loading, error };
}
