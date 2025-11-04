import {
    getFirestore,
    doc as docRef,
    updateDoc,
    arrayUnion,
  } from '@react-native-firebase/firestore';
  import { createOrGetConversation } from '@/utils/createOrGetConversation'; 
  // The function you shared
  
  /**
   * A custom hook that returns two functions:
   *   likeUser(swipedUser, isMatch?)
   *   dislikeUser(swipedUser)
   *
   * Each updates Firestore, optionally creates a conversation if matched.
   *
   * Usage:
   *   const { likeUser, dislikeUser } = useSwipeActions(currentUserId);
   *   ...
   *   await likeUser(swipedUser, true); // if "isMatch" is known
   */
  export function useSwipeActions(currentUserId?: string) {
    const db = getFirestore();
  
    // "Like" a user
    async function likeUser(
      swipedUser: { id: string; isMatch?: boolean },
      isMatch?: boolean
    ) {
      if (!currentUserId || !swipedUser?.id) return;
  
      // 1) Update the current user's "liked" array
      await updateDoc(docRef(db, 'users', currentUserId), {
        liked: arrayUnion(swipedUser.id),
      });
  
      // 2) If we know it's a match (or "isMatch" is true),
      //    create/fetch a conversation.
      //    You might do more logic: check if other user has liked current user, etc.
      console.log('isMatch', isMatch);
      if (isMatch) {
        await handleMatch(currentUserId, swipedUser.id);
      }
    }
  
    // "Dislike" a user
    async function dislikeUser(swipedUser: { id: string }) {
      if (!currentUserId || !swipedUser?.id) return;
  
      // Update the current user's "disliked" array
      await updateDoc(docRef(db, 'users', currentUserId), {
        disliked: arrayUnion(swipedUser.id),
      });
    }
  
    // Helper that calls createOrGetConversation
    async function handleMatch(userA: string, userB: string) {
      try {
        const conversationId = await createOrGetConversation(userA, userB);
        console.log('Conversation created/fetched: ', conversationId);
        // You could do any side effects here
        // e.g. return conversationId if the caller needs it
      } catch (err) {
        console.error('Error creating/fetching conversation:', err);
      }
    }
  
    return { likeUser, dislikeUser };
  }
  