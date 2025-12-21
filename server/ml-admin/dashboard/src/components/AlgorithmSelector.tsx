import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Button,
  Snackbar,
  Skeleton,
  Stack,
} from '@mui/material';
import { Psychology, AutoAwesome, Save, MergeType } from '@mui/icons-material';
import { mlAdminApi, MLHealth } from '../api/mlAdminApi';
import { useAlgorithm } from '../contexts/AlgorithmContext';

export const AlgorithmSelector: React.FC = () => {
  const { currentAlgorithm, refreshAlgorithm } = useAlgorithm();
  const [mlHealth, setMlHealth] = useState<MLHealth | null>(null);
  const [cbHealth, setCbHealth] = useState<MLHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>(currentAlgorithm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Update selected algorithm when current algorithm changes
  useEffect(() => {
    setSelectedAlgorithm(currentAlgorithm);
  }, [currentAlgorithm]);

  // Fetch service health
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const [ml, cb] = await Promise.all([
          mlAdminApi.mlServiceHealth().catch(() => ({ status: 'unavailable' })),
          mlAdminApi.cbServiceHealth().catch(() => ({ status: 'unavailable' })),
        ]);
        setMlHealth(ml as MLHealth);
        setCbHealth(cb as MLHealth);
      } catch (err) {
        console.error('Failed to fetch health:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleAlgorithmChange = (event: any) => {
    const algorithm = event.target.value;
    setSelectedAlgorithm(algorithm);
  };

  const handleSaveAlgorithm = async () => {
    if (selectedAlgorithm === currentAlgorithm) {
      setSnackbar({
        open: true,
        message: 'Algorithm is already set to this value',
        severity: 'info' as any,
      });
      return;
    }

    setSaving(true);
    try {
      const result = await mlAdminApi.setAlgorithm(selectedAlgorithm);
      await refreshAlgorithm(); // Refresh from context
      setSnackbar({
        open: true,
        message: result.message || `Algorithm successfully set to ${result.algorithm}`,
        severity: 'success',
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Failed to set algorithm',
        severity: 'error',
      });
      // Revert selection on error
      setSelectedAlgorithm(currentAlgorithm);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rounded" height={52} />
            <Skeleton variant="rounded" height={40} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const mlHealthy = mlHealth?.status === 'healthy';
  const cbHealthy = cbHealth?.status === 'healthy';

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Psychology sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Recommendation Algorithm
          </Typography>
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Current Algorithm: <strong>{currentAlgorithm}</strong>
          </Typography>
        </Box>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="algorithm-select-label">Algorithm</InputLabel>
          <Select
            labelId="algorithm-select-label"
            id="algorithm-select"
            value={selectedAlgorithm}
            label="Algorithm"
            onChange={handleAlgorithmChange}
            disabled={saving}
          >
            <MenuItem value="Hybrid">
              <Box display="flex" alignItems="center">
                <MergeType sx={{ mr: 1, fontSize: 'small' }} />
                <span>Hybrid (Two-Tower + Content-Based)</span>
                {mlHealthy && cbHealthy ? (
                  <Chip label="Online" color="success" size="small" sx={{ ml: 1 }} />
                ) : (
                  <Chip label="Partial" color="warning" size="small" sx={{ ml: 1 }} />
                )}
              </Box>
            </MenuItem>
            <MenuItem value="TwoTower">
              <Box display="flex" alignItems="center">
                <AutoAwesome sx={{ mr: 1, fontSize: 'small' }} />
                <span>Two-Tower (Neural Network)</span>
                {mlHealthy ? (
                  <Chip label="Online" color="success" size="small" sx={{ ml: 1 }} />
                ) : (
                  <Chip label="Offline" color="error" size="small" sx={{ ml: 1 }} />
                )}
              </Box>
            </MenuItem>
            <MenuItem value="ContentBased">
              <Box display="flex" alignItems="center">
                <Psychology sx={{ mr: 1, fontSize: 'small' }} />
                <span>Content-Based (Sparse Vectors)</span>
                {cbHealthy ? (
                  <Chip label="Online" color="success" size="small" sx={{ ml: 1 }} />
                ) : (
                  <Chip label="Offline" color="error" size="small" sx={{ ml: 1 }} />
                )}
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Save />}
            onClick={handleSaveAlgorithm}
            disabled={saving || selectedAlgorithm === currentAlgorithm}
          >
            {saving ? 'Saving...' : 'Save Algorithm'}
          </Button>
        </Box>

        {selectedAlgorithm === 'TwoTower' && !mlHealthy && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Two-Tower ML Service is currently unavailable. Please use Content-Based algorithm or check service status.
          </Alert>
        )}

        {selectedAlgorithm === 'ContentBased' && !cbHealthy && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Content-Based Service is currently unavailable. Please use Two-Tower algorithm or check service status.
          </Alert>
        )}

        {selectedAlgorithm === 'Hybrid' && (!mlHealthy || !cbHealthy) && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Hybrid mode works best when both services are online. Scores will fall back to available signals.
          </Alert>
        )}

        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            <strong>Two-Tower:</strong> Deep learning model trained on user interactions
            <br />
            <strong>Content-Based:</strong> Feature-based similarity using games, categories, and languages
            <br />
            <strong>Hybrid:</strong> Weighted blend of Two-Tower, Content-Based, preferences, and interactions
          </Typography>
        </Box>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
        />
      </CardContent>
    </Card>
  );
};

