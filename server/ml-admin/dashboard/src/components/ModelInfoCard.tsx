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
import { CheckCircle, Error, AccessTime, Storage } from '@mui/icons-material';
import { mlAdminApi, ModelInfo } from '../api/mlAdminApi';

export const ModelInfoCard: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModelInfo = useCallback(async () => {
    try {
      const data = await mlAdminApi.getModelInfo();
      
      // Only update if data actually changed
      setModelInfo((prevInfo) => {
        return JSON.stringify(data) !== JSON.stringify(prevInfo) ? data : prevInfo;
      });
      setError(null);
    } catch (err: any) {
      setError((prevError) => err.message !== prevError ? err.message : prevError);
    } finally {
      setLoading((prevLoading) => prevLoading ? false : prevLoading);
    }
  }, []);

  useEffect(() => {
    fetchModelInfo();
    const interval = setInterval(fetchModelInfo, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchModelInfo]);

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

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Model Information
          </Typography>
          {modelInfo?.exists ? (
            <Chip
              icon={<CheckCircle />}
              label="Model Loaded"
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<Error />}
              label="No Model"
              color="error"
              size="small"
            />
          )}
        </Box>

        {modelInfo?.exists ? (
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <Storage sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Size: <strong>{modelInfo.size_mb} MB</strong>
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" mb={1}>
              <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Last Modified:{' '}
                <strong>
                  {new Date(modelInfo.last_modified!).toLocaleString()}
                </strong>
              </Typography>
            </Box>

            <Box display="flex" alignItems="center">
              <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Age: <strong>{modelInfo.age_hours?.toFixed(1)} hours</strong>
              </Typography>
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 2, display: 'block', wordBreak: 'break-all' }}
            >
              Path: {modelInfo.path}
            </Typography>
          </Box>
        ) : (
          <Alert severity="warning">{modelInfo?.message}</Alert>
        )}
      </CardContent>
    </Card>
  );
};


