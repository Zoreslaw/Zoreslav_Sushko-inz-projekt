import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';

interface UseConversationInfoResult {
  otherUserName: string;
  otherUserId: string;
  otherUserPhotoUrl?: string;
  otherUserOnline: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch the conversation info and the "other" user's details for a 1-on-1 chat.
 */
export function useConversationInfo(conversationId: string): UseConversationInfoResult {
  const { user } = useAuth();
  const [otherUserName, setOtherUserName] = useState('Unknown');
  const [otherUserId, setOtherUserId] = useState('');
  const [otherUserPhotoUrl, setOtherUserPhotoUrl] = useState<string | undefined>();
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversationInfo = useCallback(async () => {
    if (!conversationId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const conversation = await api.getConversation(conversationId);

      setOtherUserName(conversation.otherUserName || 'Unknown');
      setOtherUserId(conversation.otherUserId);
      setOtherUserPhotoUrl(conversation.otherUserPhotoUrl);
      setOtherUserOnline(conversation.otherUserOnline);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching conversation info:', err);
      setError(err.message || 'Failed to fetch conversation info');
      setOtherUserName('Unknown');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchConversationInfo();
  }, [fetchConversationInfo]);

  return {
    otherUserName,
    otherUserId,
    otherUserPhotoUrl,
    otherUserOnline,
    loading,
    error,
  };
}

