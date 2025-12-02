import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material';
import { DataObject, Refresh } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

export const DataGenerator: React.FC = () => {
  const [count, setCount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const data = await mlAdminApi.getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleGenerate = async () => {
    if (count < 1) {
      setError('Count must be at least 1');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await mlAdminApi.generateInteractions(count);
      setSuccess(
        `Generated ${result.interactions_created || result.interactionsCreated} interactions! ` +
        `Total likes: ${result.total_likes || result.totalLikes}, ` +
        `Total dislikes: ${result.total_dislikes || result.totalDislikes}`
      );
      // Reload stats after generation
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to generate interactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <DataObject />
          <Typography variant="h6">Test Data Generator</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          Generate random user interactions (likes/dislikes) for testing recommendation metrics.
          This creates realistic test data by randomly assigning interactions between users.
        </Typography>

        {/* Current Stats */}
        {stats && (
          <Box mb={3} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Current Database Stats:
            </Typography>
            <Grid container spacing={2}>
              <Grid>
                <Chip label={`Users: ${stats.total_users || 0}`} color="primary" variant="outlined" />
              </Grid>
              <Grid>
                <Chip label={`Likes: ${stats.total_likes || 0}`} color="success" variant="outlined" />
              </Grid>
              <Grid>
                <Chip label={`Dislikes: ${stats.total_dislikes || 0}`} color="error" variant="outlined" />
              </Grid>
              <Grid>
                <Chip label={`Total Interactions: ${stats.total_interactions || 0}`} variant="outlined" />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Generate Form */}
        <Box display="flex" gap={2} alignItems="flex-start" mb={2}>
          <TextField
            label="Number of Interactions"
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 0)}
            inputProps={{ min: 1, max: 1000 }}
            helperText="Recommended: 50-200 interactions"
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={loading || count < 1}
            startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
            sx={{ mt: 1 }}
          >
            {loading ? 'Generating...' : 'Generate Interactions'}
          </Button>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary">
          💡 Tip: After generating interactions, refresh the Metrics section to see updated results.
        </Typography>
      </CardContent>
    </Card>
  );
};

