import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, Message as ApiMessage } from '@/services/api';

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
  markAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMessages(conversationId: string): UseMessagesResult {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!user || !conversationId) {
      setLoading(false);
      setMessages([]);
      return;
    }

    try {
      const data = await api.getMessages(conversationId, 100);

      const msgs: Message[] = data.map((msg: ApiMessage) => ({
        id: msg.id,
        message: msg.message,
        messageType: msg.messageType,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        status: msg.status,
        timestamp: new Date(msg.timestamp).getTime(),
        url: msg.url,
      }));

      setMessages(msgs);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [user, conversationId]);

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 3 seconds (for real-time feel)
    if (user && conversationId) {
      pollInterval.current = setInterval(fetchMessages, 3000);
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [fetchMessages, user, conversationId]);

  // Auto-mark messages as read when they change
  useEffect(() => {
    if (!user || !conversationId || messages.length === 0) return;

    const unreadFromOther = messages.filter(
      (m) => m.senderId !== user.userId && m.status === 'Sent'
    );

    if (unreadFromOther.length > 0) {
      const messageIds = unreadFromOther.map((m) => m.id);
      api.markMessagesAsRead(conversationId, messageIds).catch(console.error);
    }
  }, [messages, user, conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !conversationId) return;

      try {
        const newMessage = await api.sendMessage(conversationId, text);

        // Add the new message to the list
        setMessages((prev) => [
          ...prev,
          {
            id: newMessage.id,
            message: newMessage.message,
            messageType: newMessage.messageType,
            senderId: newMessage.senderId,
            recipientId: newMessage.recipientId,
            status: newMessage.status,
            timestamp: new Date(newMessage.timestamp).getTime(),
            url: newMessage.url,
          },
        ]);
      } catch (err: any) {
        console.error('Error sending message:', err);
        setError(err.message || 'Failed to send message');
        throw err;
      }
    },
    [user, conversationId]
  );

  const markAsRead = useCallback(async () => {
    if (!user || !conversationId) return;

    try {
      await api.markMessagesAsRead(conversationId);
    } catch (err: any) {
      console.error('Error marking messages as read:', err);
    }
  }, [user, conversationId]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}

