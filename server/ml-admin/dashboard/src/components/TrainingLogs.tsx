import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle, Error, AutoMode } from '@mui/icons-material';
import { mlAdminApi, TrainingLog } from '../api/mlAdminApi';

export const TrainingLogs: React.FC = () => {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const [logsData, statusData] = await Promise.all([
        mlAdminApi.getTrainingLogs(20),
        mlAdminApi.getTrainingStatus()
      ]);
      
      // Only update if actual training history changed OR training status changed
      setLogs((prevLogs) => {
        // Check if we need to add/remove in_progress entry
        const hadInProgress = prevLogs[0]?.status === 'in_progress';
        const needsInProgress = statusData.is_training;
        
        // Remove in_progress from prevLogs for comparison
        const prevLogsWithoutInProgress = hadInProgress ? prevLogs.slice(1) : prevLogs;
        
        // Compare actual history (without in_progress)
        const historyChanged = JSON.stringify(logsData) !== JSON.stringify(prevLogsWithoutInProgress);
        const statusChanged = hadInProgress !== needsInProgress;
        
        if (!historyChanged && !statusChanged) {
          return prevLogs; // No changes
        }
        
        // Build new logs array
        let allLogs = [...logsData];
        if (needsInProgress) {
          const inProgressEntry: TrainingLog = {
            timestamp: 'IN_PROGRESS',
            status: 'in_progress',
          } as const;
          let allLogs = [...logsData];
          if (needsInProgress) {
            allLogs = [inProgressEntry, ...allLogs];
          }
        }
        
        return allLogs;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchLogs]);

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
        <Typography variant="h6" gutterBottom>
          Training History
        </Typography>

        {logs.length === 0 ? (
          <Alert severity="info">No training logs available yet</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Interactions</TableCell>
                  <TableCell align="right">Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log, index) => (
                  <TableRow key={`${log.timestamp}-${index}`} hover>
                  <TableCell>
                    {log.status === 'in_progress'
                      ? 'Training in progress...'
                      : log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : '—'}
                  </TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <Chip
                          icon={<CheckCircle />}
                          label="Success"
                          color="success"
                          size="small"
                        />
                      ) : log.status === 'in_progress' ? (
                        <Chip
                          icon={<AutoMode />}
                          label="In Progress"
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<Error />}
                          label="Error"
                          color="error"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {log.num_users?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell align="right">
                      {log.num_interactions?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell align="right">
                      {log.duration_seconds
                        ? `${log.duration_seconds.toFixed(1)}s`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};


