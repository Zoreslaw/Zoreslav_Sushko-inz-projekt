import { api } from '@/services/api';

// /**
//  * A custom hook that returns two functions:
//  *   likeUser(targetUserId, isMatch?)
//  *   dislikeUser(targetUserId)
//  *
//  * Each calls the backend API to record the swipe action.
//  * If it's a match, a conversation is automatically created.
//  *
//  * Usage:
//  *   const { likeUser, dislikeUser } = useSwipeActions(currentUserId);
//  *   const result = await likeUser(targetUserId);
//  *   if (result?.isMatch) { /* handle match */ }
//  */
export function useSwipeActions(currentUserId?: string) {
  // "Like" a user
  async function likeUser(swipedUser: { id: string; isMatch?: boolean }) {
    if (!currentUserId || !swipedUser?.id) return null;

    try {
      const result = await api.likeUser(swipedUser.id);
      console.log('Like result:', result);
      
      if (result.isMatch) {
        console.log('It\'s a match! Conversation:', result.conversationId);
      }

      return result;
    } catch (err) {
      console.error('Error liking user:', err);
      return null;
    }
  }

  // "Dislike" a user
  async function dislikeUser(swipedUser: { id: string }) {
    if (!currentUserId || !swipedUser?.id) return null;

    try {
      const result = await api.dislikeUser(swipedUser.id);
      console.log('Dislike result:', result);
      return result;
    } catch (err) {
      console.error('Error disliking user:', err);
      return null;
    }
  }

  return { likeUser, dislikeUser };
}

