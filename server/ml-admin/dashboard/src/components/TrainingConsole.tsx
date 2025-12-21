import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, Typography, Box, Paper, IconButton, Chip, Skeleton, Stack } from '@mui/material';
import { Close, ExpandMore, ExpandLess } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

interface TrainingConsoleProps {
  onClose: () => void;
}

export const TrainingConsole: React.FC<TrainingConsoleProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const retryRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;

    const attach = () => {
      // Exponential backoff up to ~30s
      const delay = Math.min(30000, 500 * Math.pow(2, retryRef.current));
      const timeout = setTimeout(() => {
        if (!mounted) return;

        const eventSource = mlAdminApi.streamTrainingLogsRaw(lastIdRef.current ?? undefined);
        esRef.current = eventSource;

        eventSource.onmessage = (e) => {
          if (!mounted) return;
          lastIdRef.current = e.lastEventId || lastIdRef.current;

          const text = (e.data || '').trim();
          if (!text) return;

          // heartbeat events are nice to keep connection alive
          if (e.type === 'heartbeat' || text === '<3') return;

          setIsWaiting(false);

          if (text === '[TRAINING COMPLETED]') {
            setIsTraining(false);
            eventSource.close();
            return;
          }
          setLogs((prev) => [...prev, text]);
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          });
        };

        eventSource.addEventListener('complete', () => {
          if (!mounted) return;
          setIsTraining(false);
          setIsWaiting(false);
          eventSource.close();
        });

        eventSource.onerror = () => {
          if (!mounted) return;
          try {
            eventSource.close();
          } catch {}
          retryRef.current += 1;
          attach();
        };
      }, delay);
      return () => clearTimeout(timeout);
    };

    const cancel = attach();

    const spinnerTimeout = setTimeout(() => {
      if (mounted && logs.length === 0) {
        setIsWaiting(false);
      }
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(spinnerTimeout);
      cancel?.();
      if (esRef.current) esRef.current.close();
    };
  }, [logs.length]);

  return (
    <Card sx={{ mt: 2, border: '2px solid #90caf9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#1976d2', color: 'white', p: 1, px: 2 }}>
        <Chip
          label={isTraining ? 'Live' : 'Complete'}
          size="small"
          color={isTraining ? 'success' : 'default'}
          sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
        />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {isTraining ? 'Training in Progress' : 'Training Completed'}
        </Typography>
        <IconButton size="small" onClick={() => setIsCollapsed(!isCollapsed)} sx={{ color: 'white', mr: 1 }}>
          {isCollapsed ? <ExpandMore /> : <ExpandLess />}
        </IconButton>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {!isCollapsed && (
        <CardContent sx={{ p: 0 }}>
          <Paper
            ref={containerRef}
            sx={{
              bgcolor: '#1e1e1e',
              color: '#d4d4d4',
              p: 2,
              maxHeight: '500px',
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
            }}
          >
            {isWaiting && logs.length === 0 ? (
              <Stack spacing={1} alignItems="center" py={3}>
                <Skeleton variant="circular" width={40} height={40} />
                <Typography sx={{ color: '#90caf9', fontSize: '14px' }}>
                  {isTraining ? 'Starting training...' : 'Waiting for logs...'}
                </Typography>
                <Typography sx={{ color: '#666', fontSize: '12px', mt: 1 }}>
                  This may take a few seconds
                </Typography>
              </Stack>
            ) : (
              <>
                {logs.map((log, idx) => {
                  const color =
                    log.includes('ERROR') || log.includes('Error') ? '#ff6b6b' :
                    log.includes('WARNING') || log.includes('Warning') ? '#ffd93d' :
                    log.includes('INFO') || log.startsWith('Epoch') ? '#6bcf7f' :
                    log.startsWith('=') ? '#90caf9' : '#d4d4d4';
                  return (
                    <Box key={idx} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', py: 0.2, color }}>
                      {log}
                    </Box>
                  );
                })}
              </>
            )}
          </Paper>
        </CardContent>
      )}
    </Card>
  );
};
