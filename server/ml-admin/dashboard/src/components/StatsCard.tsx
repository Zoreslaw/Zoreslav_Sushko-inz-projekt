import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Alert,
  Skeleton,
} from '@mui/material';
import { People, ThumbUp, ThumbDown, Insights } from '@mui/icons-material';
import { mlAdminApi, Stats } from '../api/mlAdminApi';

export const StatsCard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await mlAdminApi.getStats();
      
      // Only update if data actually changed
      setStats((prevStats) => {
        return JSON.stringify(data) !== JSON.stringify(prevStats) ? data : prevStats;
      });
      setError(null);
    } catch (err: any) {
      setError((prevError) => err.message !== prevError ? err.message : prevError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Database Statistics
          </Typography>
          <Grid container spacing={2} mt={1}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                  }}
                >
                  <Skeleton variant="circular" width={36} height={36} />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: 'Total Users',
      value: stats?.total_users || 0,
      icon: <People fontSize="large" color="primary" />,
      color: '#1976d2',
    },
    {
      label: 'Likes',
      value: stats?.total_likes || 0,
      icon: <ThumbUp fontSize="large" color="success" />,
      color: '#2e7d32',
    },
    {
      label: 'Dislikes',
      value: stats?.total_dislikes || 0,
      icon: <ThumbDown fontSize="large" color="error" />,
      color: '#d32f2f',
    },
    {
      label: 'Total Interactions',
      value: stats?.total_interactions || 0,
      icon: <Insights fontSize="large" color="info" />,
      color: '#0288d1',
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Database Statistics
        </Typography>
        <Grid container spacing={2} mt={1}>
          {statItems.map((item, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: `2px solid ${item.color}20`,
                }}
              >
                {item.icon}
                <Typography variant="h4" sx={{ mt: 1, color: item.color }}>
                  {item.value.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

