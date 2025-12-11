import { useState, useEffect, useCallback } from 'react';
import { api, MatchUser } from '@/services/api';

// Transform MatchUser to card format expected by SwipeCard component
interface SwipeCardData {
  user: {
    id: string;
    displayName: string;
    photoURL?: string;
    favoriteGames: string[];
    bio?: string;
    age: number;
    gender: string;
    otherGames: string[];
    languages: string[];
    liked: string[];
    isMatch: boolean;
  };
}

export function useGetMatch(userId: string) {
  const [cards, setCards] = useState<SwipeCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!userId) {
        throw new Error('No user ID provided');
      }

      const matches = await api.getMatches(50);
      console.log('Found matches:', matches.length);
      
      // Transform matches to match SwipeCard expected format
      const transformedMatches = matches.map(match => ({
        user: {
          id: match.id,
          displayName: match.displayName,
          photoURL: match.photoUrl, // Map photoUrl to photoURL
          favoriteGames: match.favoriteGames,
          bio: match.description, // Map description to bio
          age: match.age,
          gender: match.gender,
          otherGames: match.otherGames,
          languages: match.languages,
          liked: [], // Add empty array for liked
          isMatch: match.isMatch
        }
      }));
      
      console.log('Transformed matches:', transformedMatches);
      setCards(transformedMatches);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('complete your profile')) {
          setError('Please complete your profile to start matching with others!');
        } else {
          console.error('Error fetching matches:', err);
          setError(err.message);
        }
      } else {
        setError('Failed to fetch matches');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchMatches();
    }
  }, [userId, fetchMatches]);

  const refresh = () => {
    if (userId) {
      fetchMatches();
    }
  };

  return { cards, isLoading, error, refresh };
}

