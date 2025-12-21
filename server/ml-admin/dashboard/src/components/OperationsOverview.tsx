import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoMode,
  CheckCircle,
  ExpandMore,
  PendingActions,
  Refresh,
  Terminal,
  WarningAmber,
} from '@mui/icons-material';
import { mlAdminApi, TrainingStatus } from '../api/mlAdminApi';

type LogSnapshot = {
  logs: string[];
  is_training: boolean;
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export const OperationsOverview: React.FC = () => {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [logs, setLogs] = useState<LogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [statusData, logData] = await Promise.all([
        mlAdminApi.getTrainingStatus(),
        mlAdminApi.getCurrentLogFile(),
      ]);
      setStatus(statusData);
      setLogs(logData);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const latestLogLines = useMemo(() => {
    if (!logs?.logs?.length) return [];
    return logs.logs.slice(-8);
  }, [logs]);

  const isTraining = status?.is_training ?? logs?.is_training ?? false;

  return (
    <Card>
      <CardHeader
        title="Operations Pulse"
        subheader="Live status and recent training activity"
        action={
          <Tooltip title="Refresh status">
            <Button
              size="small"
              startIcon={<Refresh fontSize="small" />}
              onClick={refresh}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
          </Tooltip>
        }
      />
      <CardContent>
        {loading && (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                icon={isTraining ? <AutoMode /> : <CheckCircle />}
                label={isTraining ? 'Training Active' : 'Training Idle'}
                color={isTraining ? 'warning' : 'success'}
                size="small"
              />
              {status?.last_training?.status && (
                <Chip
                  icon={status.last_training.status === 'success' ? <CheckCircle /> : <WarningAmber />}
                  label={`Last run: ${status.last_training.status}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Last training checkpoint
              </Typography>
              <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatTimestamp(status?.last_training?.timestamp)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Users
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {status?.last_training?.num_users ?? 'n/a'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {status?.last_training?.duration_seconds
                      ? `${status.last_training.duration_seconds.toFixed(1)}s`
                      : 'n/a'}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {isTraining && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Training activity
                </Typography>
                <LinearProgress sx={{ mt: 1 }} />
              </Box>
            )}

            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Terminal fontSize="small" />
                  <Typography variant="subtitle2">Latest training log tail</Typography>
                  <Chip
                    label={`${latestLogLines.length} lines`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                {latestLogLines.length === 0 ? (
                  <Alert severity="info">No log lines available yet.</Alert>
                ) : (
                  <List dense>
                    {latestLogLines.map((line, index) => (
                      <ListItem key={`${index}-${line.slice(0, 12)}`}>
                        <ListItemIcon>
                          <PendingActions fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={line} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
