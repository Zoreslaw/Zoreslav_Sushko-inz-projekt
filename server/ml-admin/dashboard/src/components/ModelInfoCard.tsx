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
import { CheckCircle, Error, AccessTime, Storage, Psychology } from '@mui/icons-material';
import { mlAdminApi, ModelInfo } from '../api/mlAdminApi';
import { useAlgorithm } from '../contexts/AlgorithmContext';

export const ModelInfoCard: React.FC = () => {
  const { currentAlgorithm } = useAlgorithm();
  const [modelInfo, setModelInfo] = useState<ModelInfo | any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModelInfo = useCallback(async () => {
    try {
      let data: ModelInfo | any;
      if (currentAlgorithm === 'ContentBased') {
        data = await mlAdminApi.getCBModelInfo();
      } else {
        data = await mlAdminApi.getModelInfo();
      }
      
      // Only update if data actually changed
      setModelInfo((prevInfo: ModelInfo | any) => {
        return JSON.stringify(data) !== JSON.stringify(prevInfo) ? data : prevInfo;
      });
      setError(null);
    } catch (err: any) {
      setError((prevError) => err.message !== prevError ? err.message : prevError);
    } finally {
      setLoading(false);
    }
  }, [currentAlgorithm]);

  useEffect(() => {
    fetchModelInfo();
    const interval = setInterval(fetchModelInfo, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchModelInfo]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={24} />
          </Stack>
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

  const isContentBased = currentAlgorithm === 'ContentBased';

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          {isContentBased ? (
            <Psychology sx={{ mr: 1 }} />
          ) : (
            <Storage sx={{ mr: 1 }} />
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {isContentBased ? 'CB Service Information' : 'Model Information'}
          </Typography>
          {modelInfo?.exists ? (
            <Chip
              icon={<CheckCircle />}
              label={isContentBased ? 'Service Ready' : 'Model Loaded'}
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<Error />}
              label={isContentBased ? 'Not Ready' : 'No Model'}
              color="error"
              size="small"
            />
          )}
        </Box>

        {modelInfo?.exists ? (
          <Box>
            {isContentBased ? (
              <>
                {modelInfo.version && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Version: <strong>{modelInfo.version}</strong>
                    </Typography>
                  </Box>
                )}
                {modelInfo.architecture && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Architecture: <strong>{modelInfo.architecture}</strong>
                    </Typography>
                  </Box>
                )}
                {modelInfo.parameters && (
                  <>
                    {modelInfo.parameters.dimension && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          Feature Dimension: <strong>{modelInfo.parameters.dimension}</strong>
                        </Typography>
                      </Box>
                    )}
                    {modelInfo.parameters.vocab_games && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          Games Vocabulary: <strong>{modelInfo.parameters.vocab_games}</strong>
                        </Typography>
                      </Box>
                    )}
                    {modelInfo.parameters.vocab_categories && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          Categories Vocabulary: <strong>{modelInfo.parameters.vocab_categories}</strong>
                        </Typography>
                      </Box>
                    )}
                    {modelInfo.parameters.vocab_languages && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          Languages Vocabulary: <strong>{modelInfo.parameters.vocab_languages}</strong>
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                {modelInfo.users_fitted !== undefined && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Users Fitted: <strong>{modelInfo.users_fitted}</strong>
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </Box>
        ) : (
          <Alert severity="warning">{modelInfo?.message || 'Service not available'}</Alert>
        )}
      </CardContent>
    </Card>
  );
};
