import { useEffect, useState, useCallback } from 'react';
import { api, ProfileStats } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface UseProfileStatsResult {
  stats: ProfileStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProfileStats(): UseProfileStatsResult {
  const { user } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.getProfileStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching profile stats:', err);
      setError(err.message || 'Failed to fetch profile stats');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
