import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, Conversation } from '@/services/api';

export interface ChatItem {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadMessages: number;
  avatarUrl?: string;
  otherUserId: string;
  isOnline?: boolean;
}

interface UseConversationsResult {
  conversations: ChatItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useConversations(): UseConversationsResult {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setConversations([]);
      return;
    }

    try {
      const data = await api.getConversations();

      const items: ChatItem[] = data.map((conv: Conversation) => {
        let lastMessageTime = '';
        if (conv.lastMessageTime) {
          lastMessageTime = new Date(conv.lastMessageTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        return {
          id: conv.id,
          name: conv.otherUserName,
          lastMessage: conv.lastMessage || '',
          lastMessageTime,
          unreadMessages: conv.unreadCount,
          avatarUrl: conv.otherUserPhotoUrl,
          otherUserId: conv.otherUserId,
          isOnline: conv.otherUserOnline,
        };
      });

      setConversations(items);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError(err.message || 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();

    // Poll for new conversations every 10 seconds
    if (user) {
      pollInterval.current = setInterval(fetchConversations, 10000);
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [fetchConversations, user]);

  return { conversations, loading, error, refresh: fetchConversations };
}

