import { useEffect, useState, useCallback } from 'react';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc as docRef,
  getDoc,
} from '@react-native-firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

export interface Message {
  id: string;
  message: string;
  messageType: string;
  senderId: string;
  recipientId: string;
  status: string;
  timestamp: number;
  url?: string;
}

interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  markAsRead?: () => Promise<void>;
}

/**
 * A hook that manages messages in a conversation, including setting message status to "Read".
 */
export function useMessages(conversationId: string): UseMessagesResult {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }

    const db = getFirestore();
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const msgs: Message[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              id: docSnap.id,
              message: data.message ?? '',
              messageType: data.messageType ?? 'Text',
              senderId: data.senderId ?? '',
              recipientId: data.recipientId ?? '',
              status: data.status ?? 'Sent',
              timestamp: data.timestamp ?? 0,
              url: data.url ?? undefined,
            };
          });
          setMessages(msgs);
          setLoading(false);
        } catch (err: any) {
          console.error('Error parsing messages:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, conversationId]);

  useEffect(() => {
    if (!user || !conversationId) return;
    if (messages.length === 0) return;

    const db = getFirestore();
    const unreadFromOther = messages.filter(
      (m) => m.senderId !== user.uid && m.status === 'Sent'
    );

    unreadFromOther.forEach(async (m) => {
      try {
        const docPath = docRef(db, 'conversations', conversationId, 'messages', m.id);
        await updateDoc(docPath, { status: 'Read' });
      } catch (err) {
        console.error('Failed to mark message as read:', err);
      }
    });
  }, [messages, user, conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !conversationId) return;
      try {
        const db = getFirestore();
        const conversationDocRef = docRef(db, 'conversations', conversationId);
        const conversationDocSnap = await getDoc(conversationDocRef);
        let recipientId = '';
        if (conversationDocSnap.exists) {
          const conversationData = conversationDocSnap.data();
          const participantIds: string[] = conversationData?.participantIds || [];
          const otherParticipants = participantIds.filter((id) => id !== user.uid);
          if (otherParticipants.length === 1) {
            recipientId = otherParticipants[0];
          }
        }
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');

        await addDoc(messagesRef, {
          message: text,
          messageType: 'Text',
          senderId: user.uid,
          recipientId: recipientId,
          status: 'Sent',
          timestamp: Date.now(),
        });

        await updateDoc(conversationDocRef, {
          'lastMessage.message': text,
          'lastMessage.senderId': user.uid,
          'lastMessage.timestamp': Date.now(),
          lastUpdatedAt: Date.now(),
        });
      } catch (err: any) {
        console.error('Error sending message:', err);
        setError(err.message);
      }
    },
    [user, conversationId]
  );

  const markAsRead = useCallback(async () => {
    if (!user || !conversationId) return;
    try {
      const db = getFirestore();
      const conversationDocRef = docRef(db, 'conversations', conversationId);
      await updateDoc(conversationDocRef, {
        [`lastReadAt.${user.uid}`]: Date.now(),
      });
    } catch (err: any) {
      console.error('Error marking as read:', err);
      setError(err.message);
    }
  }, [user, conversationId]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
  };
}
