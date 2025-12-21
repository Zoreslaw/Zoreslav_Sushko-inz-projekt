import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Alert,
  Skeleton,
  Stack,
} from '@mui/material';
import { CheckCircle, Error, Psychology } from '@mui/icons-material';
import { mlAdminApi, MLHealth } from '../api/mlAdminApi';

export const CBServiceStatus: React.FC = () => {
  const [health, setHealth] = useState<MLHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await mlAdminApi.cbServiceHealth();
      
      // Only update if data actually changed
      setHealth((prevHealth) => {
        return JSON.stringify(data) !== JSON.stringify(prevHealth) ? data : prevHealth;
      });
      setError(null);
    } catch (err: any) {
      setError((prevError) => {
        if (err.message !== prevError) {
          setHealth(null);
          return err.message;
        }
        return prevError;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="45%" />
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={24} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = health?.status === 'healthy';

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Psychology sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CB Service Status
          </Typography>
          {isHealthy ? (
            <Chip
              icon={<CheckCircle />}
              label="Healthy"
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<Error />}
              label="Unavailable"
              color="error"
              size="small"
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isHealthy && health ? (
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Model Loaded:{' '}
                <strong>{health.model_loaded ? 'Yes' : 'No'}</strong>
              </Typography>
            </Box>

            {health.model_version && (
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Model Version: <strong>{health.model_version}</strong>
                </Typography>
              </Box>
            )}

            {health.timestamp && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                Last Check: {new Date(health.timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        ) : (
          <Alert severity="warning">
            CB Service is not responding. Please check the service status.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
