import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle, Error, DeviceHub, Memory } from '@mui/icons-material';
import { mlAdminApi, MLHealth } from '../api/mlAdminApi';

export const MLServiceStatus: React.FC = () => {
  const [health, setHealth] = useState<MLHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await mlAdminApi.mlServiceHealth();
      
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
      setLoading((prevLoading) => prevLoading ? false : prevLoading);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s (less frequent)
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = health?.status === 'healthy';

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ML Service Status
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
              <DeviceHub sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Device: <strong>{health.device || 'Unknown'}</strong>
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" mb={1}>
              <Memory sx={{ mr: 1, color: 'text.secondary' }} />
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
            ML Service is not responding. Please check the service status.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};


