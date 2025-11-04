import React, { useState, useEffect, useCallback } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { Schedule } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

export const NextTrainingProgress: React.FC = () => {
  const [nextTraining, setNextTraining] = useState<Date | null>(null);
  const [intervalHours, setIntervalHours] = useState(8);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const fetchNextTraining = useCallback(async () => {
    try {
      const data = await mlAdminApi.getNextTraining();
      if (data.next_training) {
        setNextTraining(new Date(data.next_training));
        setIntervalHours(data.interval_hours);
      }
    } catch (err) {
      console.error('Error fetching next training time:', err);
    }
  }, []);

  useEffect(() => {
    fetchNextTraining();
    const interval = setInterval(fetchNextTraining, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchNextTraining]);

  useEffect(() => {
    if (!nextTraining) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = nextTraining.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Training starting...');
        setProgress(100);
        // Refetch to get new time
        setTimeout(fetchNextTraining, 5000);
        return;
      }

      // Calculate time remaining
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);

      // Calculate progress (0-100)
      const totalIntervalMs = intervalHours * 60 * 60 * 1000;
      const elapsed = totalIntervalMs - diff;
      const progressPercent = (elapsed / totalIntervalMs) * 100;
      setProgress(Math.max(0, Math.min(100, progressPercent)));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [nextTraining, intervalHours, fetchNextTraining]);

  if (!nextTraining) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Schedule sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          Next Automatic Training
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 'bold',
            color: progress > 90 ? 'warning.main' : 'primary.main',
            fontSize: '13px',
          }}
        >
          {timeRemaining}
        </Typography>
      </Box>
      
      <Box sx={{ position: 'relative' }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: progress > 90
                ? 'linear-gradient(90deg, #ff9800 0%, #f44336 100%)'
                : 'linear-gradient(90deg, #2196f3 0%, #21cbf3 100%)',
            },
          }}
        />
      </Box>
    </Box>
  );
};


