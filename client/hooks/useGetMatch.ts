import { useState, useEffect, useCallback } from 'react';
import { api, MatchUser } from '@/services/api';

export function useGetMatch(userId: string) {
  const [cards, setCards] = useState<MatchUser[]>([]);
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
      setCards(matches);
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

