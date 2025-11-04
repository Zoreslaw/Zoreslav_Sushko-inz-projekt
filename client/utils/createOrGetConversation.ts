import {
    getFirestore,
    collection,
    doc as docRef,
    addDoc,
    getDocs,
    query,
    where,
    limit,
    updateDoc,
  } from '@react-native-firebase/firestore';
  
  /**
   * Creates (or fetches) a one-on-one conversation between `currentUserId` and `otherUserId`
   * WITHOUT using a `participantsKey`.
   *
   * Steps:
   *   1) Fetch all conversations where participantIds array-contains `currentUserId`.
   *   2) Filter in memory for any doc whose `participantIds` also includes `otherUserId`.
   *   3) If found, return that conversation doc ID.
   *   4) Otherwise, create a new conversation doc with your fields.
   *
   * This approach is simpler, but can be less efficient for large apps, because it fetches
   * all convos for the current user, then filters in code.
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
  
    const db = getFirestore();
    const conversationsRef = collection(db, 'conversations');
  
    // Query for all conversations that contain currentUserId in participantIds.
    // This uses array-contains for one user. We'll filter the other user in code.
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', currentUserId)
    );
  
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Filter in memory to see if there's a doc that also has otherUserId in participantIds
      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const participantIds = data.participantIds || [];
        if (Array.isArray(participantIds) && participantIds.includes(otherUserId)) {
          // Found an existing conversation with both user IDs
          console.log('Found existing conversation:', docSnap.id);
          return docSnap.id;
        }
      }
    }
  
    // If not found, create a new conversation doc
    console.log('No existing conversation found. Creating new one...');
  
    // Convert Date.now() to integer seconds (if that's how your DB is storing times):
    const nowSec = Math.floor(Date.now() / 1000);
  
    // Example structure to match your DB:
    const newConversationData = {
      initiatedAt: nowSec,
      initiatedBy: currentUserId,
      lastMessage: {}, // empty
      lastReadAt: {},  // empty
      lastUpdatedAt: nowSec,
      participantIds: [currentUserId, otherUserId],
      participants: [
        docRef(db, 'users', currentUserId),
        docRef(db, 'users', otherUserId),
      ],
    };
  
    // Create the doc
    const docRefCreated = await addDoc(conversationsRef, newConversationData);
    console.log('Created new conversation:', docRefCreated.id);
  
    return docRefCreated.id;
  }
  