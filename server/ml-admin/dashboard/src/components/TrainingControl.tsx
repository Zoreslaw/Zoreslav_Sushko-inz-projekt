import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, Typography, Box, Button, Chip, Alert, Skeleton, Stack, CircularProgress } from '@mui/material';
import { PlayArrow, Stop, AutoMode, CheckCircle, Error as ErrorIcon, WarningAmber } from '@mui/icons-material';
import { mlAdminApi, TrainingStatus } from '../api/mlAdminApi';
import { TrainingConsole } from './TrainingConsole';
import { NextTrainingProgress } from './NextTrainingProgress';



export const TrainingControl: React.FC = () => {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const prevIsTrainingRef = useRef<boolean>(false);

  const statusChipFor = (value?: string | null) => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'success') {
      return <Chip label="Success" color="success" size="small" />;
    }
    if (normalized === 'error') {
      return <Chip icon={<ErrorIcon />} label="Error" color="error" size="small" />;
    }
    if (normalized === 'stopped') {
      return <Chip icon={<Stop />} label="Stopped" color="warning" size="small" />;
    }
    if (normalized === 'skipped') {
      return <Chip icon={<WarningAmber />} label="Skipped" color="warning" size="small" />;
    }
    if (!value) {
      return <Chip label="Unknown" size="small" />;
    }
    return <Chip label={value} size="small" />;
  };
  const fetchStatus = useCallback(async () => {
    try {
      const data = await mlAdminApi.getTrainingStatus();
      setStatus((prev) => {
        // auto-open console when transitioning to training
        if (data?.is_training && !prevIsTrainingRef.current) {
          setShowConsole(true);
        }
        prevIsTrainingRef.current = !!data?.is_training;
        return data;
      });
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleTriggerTraining = async () => {
    try {
      setTriggering(true);
      setMessage(null);
      await mlAdminApi.triggerTraining();
      setShowConsole(true);
      fetchStatus();
      setMessage('Training triggered.');
    } catch (e: any) {
      setError(e.message ?? 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  const handleStopTraining = async () => {
    try {
      setStopping(true);
      setMessage(null);
      await mlAdminApi.stopTraining();
      fetchStatus();
      setMessage('Stop signal sent to training process.');
    } catch (e: any) {
      setError(e.message ?? 'Stop failed');
    } finally {
      setStopping(false);
    }
  };

  const isStopping = !!status?.stop_requested && !!status?.is_training;
  const lastRun = status?.last_training ?? status?.last_success ?? null;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rounded" height={32} />
            <Skeleton variant="rounded" height={80} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Training Control</Typography>
          {status?.is_training ? (
            <Chip
              icon={isStopping ? <Stop /> : <AutoMode />}
              label={isStopping ? 'Stop Requested' : 'Training in Progress'}
              color={isStopping ? 'error' : 'warning'}
              size="small"
            />
          ) : (
            <Chip icon={<CheckCircle />} label="Idle" color="default" size="small" />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {isStopping && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Stop requested. Training will halt at the next checkpoint.
          </Alert>
        )}

        {lastRun && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="text.secondary">Last Training Run:</Typography>
            <Box mt={1}>
              <Typography variant="body2">
                <strong>Status:</strong> {statusChipFor(lastRun.status)}
              </Typography>
              {lastRun.timestamp && (
                <Typography variant="body2" mt={1}><strong>Time:</strong> {new Date(lastRun.timestamp).toLocaleString()}</Typography>
              )}
              {typeof lastRun.num_users === 'number' && (
                <Typography variant="body2" mt={1}><strong>Users:</strong> {lastRun.num_users}</Typography>
              )}
              {typeof lastRun.num_interactions === 'number' && (
                <Typography variant="body2" mt={1}><strong>Interactions:</strong> {lastRun.num_interactions}</Typography>
              )}
              {typeof lastRun.duration_seconds === 'number' && (
                <Typography variant="body2" mt={1}><strong>Duration:</strong> {lastRun.duration_seconds.toFixed(1)}s</Typography>
              )}
              {lastRun.error && <Alert severity="error" sx={{ mt: 1 }}>{lastRun.error}</Alert>}
            </Box>
          </Box>
        )}

        {status?.last_error && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="text.secondary">Last Error:</Typography>
            <Box mt={1}>
              {status.last_error.timestamp && (
                <Typography variant="body2" mt={1}><strong>Time:</strong> {new Date(status.last_error.timestamp).toLocaleString()}</Typography>
              )}
              {status.last_error.error && <Alert severity="error" sx={{ mt: 1 }}>{status.last_error.error}</Alert>}
            </Box>
          </Box>
        )}

        <Box display="flex" gap={1} mb={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={triggering ? <CircularProgress size={18} /> : <PlayArrow />}
            onClick={handleTriggerTraining}
            disabled={status?.is_training || triggering}
            sx={{ flex: 1 }}
          >
            {triggering ? 'Triggering...' : 'Trigger Training'}
          </Button>
          {status?.is_training && (
            <Button
              variant="contained"
              color="error"
              startIcon={stopping ? <CircularProgress size={18} /> : <Stop />}
              onClick={handleStopTraining}
              disabled={stopping || isStopping}
              sx={{ flex: 1 }}
            >
              {stopping ? 'Stopping...' : 'Stop Training'}
            </Button>
          )}
        </Box>

        <NextTrainingProgress />
      </CardContent>

      {showConsole && <TrainingConsole onClose={() => setShowConsole(false)} />}
    </Card>
  );
};
