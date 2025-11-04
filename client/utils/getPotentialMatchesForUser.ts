import { getFirestore, collection, getDocs, doc } from '@react-native-firebase/firestore';
// import { DocumentData } from 'firebase/firestore';
import User from '@/types/User';
import { getDescriptionSynergy } from './getDescriptionSynergy';

interface ScoredMatch {
    user: User;  // The candidate user
    score: number;      // The final match score
    isMatch: boolean;   // Whether the candidate has liked the current user
}

/**
 * MAIN FUNCTION:
 * 1) Fetch the currentUser doc
 * 2) Fetch all other users
 * 3) Filter out incompatible or disliked
 * 4) Compute a match score for each
 * 5) Sort & return top matches
 */

export async function getPotentialMatchesForUser(userId: string, limitN: number): Promise<ScoredMatch[]> {
    const db = getFirestore();
  
    // 1) Fetch the current user's profile
    const currentUserDoc = await db.collection('users').doc(userId).get();
    if (!currentUserDoc.exists) {
      throw new Error(`User ${userId} does not exist`);
    }
    const currentUser = { id: userId, ...currentUserDoc.data() } as User;
    
    // Validate current user has required fields
    if (!currentUser.preferenceAgeRange || !currentUser.preferenceGender || !currentUser.gender) {
      throw new Error('Current user profile is incomplete');
    }

    // Ensure current user has a photo URL
    if (!currentUser.photoURL) {
      currentUser.photoURL = 'https://firebasestorage.googleapis.com/v0/b/teamup-8f0c5.appspot.com/o/default-avatar.png?alt=media';
    }
  
    // 2) Fetch all user docs from /users
    const usersSnap = await db.collection('users').get();
    const allUsers: User[] = usersSnap.docs.map((d) => {
      const userData = { id: d.id, ...d.data() } as User;
      // Ensure each user has a photo URL
      if (!userData.photoURL) {
        userData.photoURL = 'https://firebasestorage.googleapis.com/v0/b/teamup-8f0c5.appspot.com/o/default-avatar.png?alt=media';
      }
      return userData;
    });

    // Pre-calculate liked status for better performance
    const likedByCurrentUser = new Set(currentUser.liked || []);
    const dislikedByCurrentUser = new Set(currentUser.disliked || []);
  
    // 3) Filter out incompatible users
    const filteredCandidates = allUsers.filter((candidate) => {
      // Skip invalid candidates
      if (!candidate.preferenceAgeRange || !candidate.preferenceGender || !candidate.gender) {
        return false;
      }

      if (candidate.id === currentUser.id) return false;
  
      // Check if currentUser has disliked them
      if (dislikedByCurrentUser.has(candidate.id)) return false;
      
      // Check if currentUser has liked them
      if (likedByCurrentUser.has(candidate.id)) return false;
  
      // Check if candidate disliked currentUser
      if (candidate.disliked?.includes(currentUser.id)) return false;
  
      // Age preference checks
      if (candidate.age < currentUser.preferenceAgeRange.min || candidate.age > currentUser.preferenceAgeRange.max) {
        return false;
      }
      if (currentUser.age < candidate.preferenceAgeRange.min || currentUser.age > candidate.preferenceAgeRange.max) {
        return false;
      }
  
      // Gender preference checks
      if (currentUser.preferenceGender !== 'Any' && currentUser.preferenceGender !== candidate.gender) {
        return false;
      }

      if (candidate.preferenceGender !== 'Any' && candidate.preferenceGender !== currentUser.gender) {
        return false;
      }

      return true;
    });
  
    // 4) Compute match scores
    const scored: ScoredMatch[] = await Promise.all(
      filteredCandidates.map(async (candidate) => {
        const score = await computeMatchScore(currentUser, candidate);
        return { 
          user: candidate, 
          score,
          isMatch: candidate.liked?.includes(currentUser.id) ?? false
        };
      })
    );
  
    // 5) Sort and return top matches
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitN);
  }
  
  /**
   * A simple scoring function that sums partial scores for:
   * - Category synergy
   * - Language overlap
   * - Favorite games overlap
   * - Age proximity
   * - If candidate has liked me
   * - Possibly more
   */
  async function computeMatchScore(me: User, candidate: User): Promise<number> {
    let total = 0;
  
    // 1) Category synergy: +10 for each shared category
    if (me.preferenceCategories && candidate.preferenceCategories) {
      candidate.preferenceCategories.forEach(category => {
        if (me.preferenceCategories.includes(category)) {
          total += 10;
        }
      });
    }
  
    // 2) Language overlap: +5 for each shared language
    if (me.languages && candidate.languages) {
      const sharedLangs = me.languages.filter(lang => candidate.languages.includes(lang));
      total += sharedLangs.length * 5;
    }
  
    // 3) Favorite games overlap: +15 for each shared favorite game
    if (me.favoriteGames && candidate.favoriteGames) {
      const commonFavGames = me.favoriteGames.filter(game => candidate.favoriteGames.includes(game));
      total += commonFavGames.length * 15;
    }
  
    // 4) Other games overlap: +10 for each shared other game
    if (me.otherGames && candidate.otherGames) {
      const commonOtherGames = me.otherGames.filter(game => candidate.otherGames.includes(game));
      total += commonOtherGames.length * 10;
    }
  
    // 5) Other games in favorite games: +5 for each other game in my favorites
    if (me.favoriteGames && candidate.otherGames) {
      const otherGamesInFavGames = candidate.otherGames.filter(game => me.favoriteGames.includes(game));
      total += otherGamesInFavGames.length * 5;
    }
  
    // 6) Age proximity: if age difference <=2 => +5, if <=5 => +3
    if (me.age && candidate.age) {
      const ageDiff = Math.abs(me.age - candidate.age);
      if (ageDiff <= 2) {
        total += 5;
      } else if (ageDiff <= 5) {
        total += 3;
      }
    }
  
    // 7) Bonus if candidate has liked me: +30
    if (candidate.liked?.includes(me.id)) {
      total += 30;
    }

    // 8) ChatGPT synergy
    // If either is missing a description, synergy=0
    if (me.description && candidate.description) {
      const synergy = await getDescriptionSynergy(me.description, candidate.description);
      console.log("synergy:", synergy)
      total += synergy;
    }
  
    console.log('Total match score:', total, 'for candidate', candidate.displayName, candidate.id);
    return total;
  }
  