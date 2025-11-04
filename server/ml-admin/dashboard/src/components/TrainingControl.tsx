import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, Typography, Box, Button, Chip, Alert, CircularProgress, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { PlayArrow, AutoMode, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { mlAdminApi, TrainingStatus, AlgorytmType } from '../api/mlAdminApi';
import { TrainingConsole } from './TrainingConsole';
import { NextTrainingProgress } from './NextTrainingProgress';



export const TrainingControl: React.FC = () => {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const prevIsTrainingRef = useRef<boolean>(false);
  const [algorytmType, setAlgorytmType] = useState<AlgorytmType>('TwoTower')

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

  const handleChange = (event: SelectChangeEvent) => {
    event.target.value === 'TwoTower' || event.target.value === 'ContentBased' ? setAlgorytmType(event.target.value) : alert("Error algorytm type is wrong...");
  };

  if (loading) {
    return (
      <Card><CardContent><Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box></CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Training Control</Typography>
          {status?.is_training ? (
            <Chip icon={<AutoMode />} label="Training in Progress" color="warning" size="small" />
          ) : (
            <Chip icon={<CheckCircle />} label="Idle" color="default" size="small" />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        {status?.last_training && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="text.secondary">Last Training:</Typography>
            <Box mt={1}>
              <Typography variant="body2">
                <strong>Status:</strong>{' '}
                {status.last_training.status === 'success' ? (
                  <Chip label="Success" color="success" size="small" />
                ) : (
                  <Chip icon={<ErrorIcon />} label="Error" color="error" size="small" />
                )}
              </Typography>
              {status.last_training.timestamp && (
                <Typography variant="body2" mt={1}><strong>Time:</strong> {new Date(status.last_training.timestamp).toLocaleString()}</Typography>
              )}
              {typeof status.last_training.num_users === 'number' && (
                <Typography variant="body2" mt={1}><strong>Users:</strong> {status.last_training.num_users}</Typography>
              )}
              {typeof status.last_training.num_interactions === 'number' && (
                <Typography variant="body2" mt={1}><strong>Interactions:</strong> {status.last_training.num_interactions}</Typography>
              )}
              {typeof status.last_training.duration_seconds === 'number' && (
                <Typography variant="body2" mt={1}><strong>Duration:</strong> {status.last_training.duration_seconds.toFixed(1)}s</Typography>
              )}
              {status.last_training.error && <Alert severity="error" sx={{ mt: 1 }}>{status.last_training.error}</Alert>}
            </Box>
          </Box>
        )}

        <Button
          variant="contained"
          color="primary"
          startIcon={triggering ? <CircularProgress size={20} /> : <PlayArrow />}
          onClick={handleTriggerTraining}
          disabled={status?.is_training || triggering}
          fullWidth
        >
          {triggering ? 'Triggering…' : 'Trigger Manual Training'}
        </Button>

        <Select
          value={algorytmType}
          onChange={handleChange}
          displayEmpty
          inputProps={{ 'aria-label': 'Without label' }}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          <MenuItem value={10}>Ten</MenuItem>
          <MenuItem value={20}>Twenty</MenuItem>
          <MenuItem value={30}>Thirty</MenuItem>
        </Select>

        <NextTrainingProgress />
      </CardContent>

      {showConsole && <TrainingConsole onClose={() => setShowConsole(false)} />}
    </Card>
  );
};
