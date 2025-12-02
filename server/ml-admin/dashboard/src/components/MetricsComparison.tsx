import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import { CompareArrows } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';
import { ComparisonCharts } from './ComparisonCharts';

interface MetricsData {
  algorithm: string;
  timestamp: string;
  userCount?: number;
  avgPrecisionAtK?: Record<number, number>;
  avgRecallAtK?: Record<number, number>;
  avgNDCGAtK?: Record<number, number>;
  avgHitRateAtK?: Record<number, number>;
  avgMutualAcceptRateAtK?: Record<number, number>;
  avgChatStartRateAtK?: Record<number, number>;
}

export const MetricsComparison: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MetricsData | null>(null);
  const [cbMetrics, setCbMetrics] = useState<MetricsData | null>(null);
  const kValues = [5, 10, 20];

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use unified comparison endpoint for fair evaluation on same holdout set
        const comparison = await mlAdminApi.compareAlgorithms(kValues).catch(() => null);
        
        if (comparison) {
          setMlMetrics(comparison.TwoTower || null);
          setCbMetrics(comparison.ContentBased || null);
        } else {
          // Fallback to separate calls if comparison endpoint fails
          const [ml, cb] = await Promise.all([
            mlAdminApi.getAggregateMetrics('TwoTower', kValues).catch(() => null),
            mlAdminApi.getAggregateMetrics('ContentBased', kValues).catch(() => null),
          ]);
          setMlMetrics(ml);
          setCbMetrics(cb);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

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

  if (error || (!mlMetrics && !cbMetrics)) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">
            {error || 'Metrics data not available. Ensure both services are running and have user interactions.'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatValue = (val: number | undefined) => {
    if (val === undefined) return '-';
    return (val * 100).toFixed(2) + '%';
  };

  const getBetter = (ml: number | undefined, cb: number | undefined) => {
    if (ml === undefined && cb === undefined) return null;
    if (ml === undefined) return 'cb';
    if (cb === undefined) return 'ml';
    return ml > cb ? 'ml' : ml < cb ? 'cb' : 'tie';
  };

  const metrics = [
    { name: 'Precision', ml: mlMetrics?.avgPrecisionAtK, cb: cbMetrics?.avgPrecisionAtK },
    { name: 'Recall', ml: mlMetrics?.avgRecallAtK, cb: cbMetrics?.avgRecallAtK },
    { name: 'NDCG', ml: mlMetrics?.avgNDCGAtK, cb: cbMetrics?.avgNDCGAtK },
    { name: 'Hit Rate', ml: mlMetrics?.avgHitRateAtK, cb: cbMetrics?.avgHitRateAtK },
    { name: 'Mutual Accept Rate', ml: mlMetrics?.avgMutualAcceptRateAtK, cb: cbMetrics?.avgMutualAcceptRateAtK },
    { name: 'Chat Start Rate', ml: mlMetrics?.avgChatStartRateAtK, cb: cbMetrics?.avgChatStartRateAtK },
  ];

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <CompareArrows sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Algorithm Comparison
          </Typography>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Metric</strong></TableCell>
                <TableCell align="center"><strong>K</strong></TableCell>
                <TableCell align="right">
                  <Chip label="TwoTower" color="primary" size="small" />
                </TableCell>
                <TableCell align="right">
                  <Chip label="ContentBased" color="secondary" size="small" />
                </TableCell>
                <TableCell align="center"><strong>Winner</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.map((metric, idx) => (
                <React.Fragment key={metric.name}>
                  {kValues.map((k, kIdx) => {
                    const mlVal = metric.ml?.[k];
                    const cbVal = metric.cb?.[k];
                    const winner = getBetter(mlVal, cbVal);
                    return (
                      <TableRow key={`${metric.name}-${k}`}>
                        {kIdx === 0 && (
                          <TableCell rowSpan={kValues.length} sx={{ verticalAlign: 'top' }}>
                            <strong>{metric.name}</strong>
                          </TableCell>
                        )}
                        <TableCell align="center">@{k}</TableCell>
                        <TableCell align="right">{formatValue(mlVal)}</TableCell>
                        <TableCell align="right">{formatValue(cbVal)}</TableCell>
                        <TableCell align="center">
                          {winner === 'ml' && <Chip label="ML" color="primary" size="small" />}
                          {winner === 'cb' && <Chip label="CB" color="secondary" size="small" />}
                          {winner === 'tie' && <Chip label="Tie" size="small" />}
                          {winner === null && <Typography variant="caption">-</Typography>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Comparison Charts */}
        {mlMetrics && cbMetrics && (
          <Box mt={3}>
            <ComparisonCharts mlMetrics={mlMetrics} cbMetrics={cbMetrics} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
