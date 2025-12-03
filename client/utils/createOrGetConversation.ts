import { api } from '@/services/api';

/**
 * Creates (or fetches) a one-on-one conversation between `currentUserId` and `otherUserId`
 * using the backend API instead of Firebase.
 *
 * Usage:
 *   const conversationId = await createOrGetConversation(currentUserId, otherUserId);
 */
export async function createOrGetConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  if (!currentUserId || !otherUserId) {
    throw new Error('Missing user IDs');
  }
  if (currentUserId === otherUserId) {
    throw new Error('Cannot create a conversation with yourself.');
  }

  try {
    const result = await api.createConversation(otherUserId);
    
    if (result.isNew) {
      console.log('Created new conversation:', result.conversationId);
    } else {
      console.log('Found existing conversation:', result.conversationId);
    }
    
    return result.conversationId;
  } catch (err) {
    console.error('Error creating/getting conversation:', err);
    throw err;
  }
}

