import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  Skeleton,
  Stack,
} from '@mui/material';
import { Assessment, TrendingUp } from '@mui/icons-material';
import { mlAdminApi, MetricsEvaluationMetadata } from '../api/mlAdminApi';
import { useAlgorithm } from '../contexts/AlgorithmContext';
import { MetricsCharts } from './MetricsCharts';

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
  precision?: Record<number, number>;
  recall?: Record<number, number>;
  ndcg?: Record<number, number>;
  hit_rate?: Record<number, number>;
  mutual_accept_rate?: Record<number, number>;
  chat_start_rate?: Record<number, number>;
  evaluation?: MetricsEvaluationMetadata;
}

export const MetricsCard: React.FC = () => {
  const { currentAlgorithm } = useAlgorithm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const kValues = [5, 10, 20];

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await mlAdminApi.getAggregateMetrics(currentAlgorithm, kValues);
        setMetrics(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [currentAlgorithm]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="rounded" height={160} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error || 'No metrics data available'}</Alert>
        </CardContent>
      </Card>
    );
  }

  const precision = metrics.avgPrecisionAtK || metrics.precision || {};
  const recall = metrics.avgRecallAtK || metrics.recall || {};
  const ndcg = metrics.avgNDCGAtK || metrics.ndcg || {};
  const hitRate = metrics.avgHitRateAtK || metrics.hit_rate || {};
  const mutualAccept = metrics.avgMutualAcceptRateAtK || metrics.mutual_accept_rate || {};
  const chatStart = metrics.avgChatStartRateAtK || metrics.chat_start_rate || {};

  const formatValue = (val: number | undefined) => {
    if (val === undefined) return '-';
    return (val * 100).toFixed(2) + '%';
  };

  const evaluation = metrics.evaluation;
  const formatFraction = (val: number | undefined) => {
    if (val === undefined) return '-';
    return `${(val * 100).toFixed(0)}%`;
  };
  const formatNumber = (val: number | undefined) => {
    if (val === undefined) return '-';
    return val.toFixed(1);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Assessment sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Recommendation Metrics ({currentAlgorithm})
          </Typography>
          {metrics.userCount && (
            <Chip
              label={`${metrics.userCount} users`}
              size="small"
              color="primary"
            />
          )}
        </Box>

        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="Recommendation Metrics" />
          <Tab label="Product Metrics" />
        </Tabs>

        {tabValue === 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Metric</TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">@{k}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><strong>Precision</strong></TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(precision[k])}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell><strong>Recall</strong></TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(recall[k])}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell><strong>NDCG</strong></TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(ndcg[k])}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell><strong>Hit Rate</strong></TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(hitRate[k])}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tabValue === 1 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Metric</TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">@{k}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <TrendingUp sx={{ mr: 1, fontSize: 'small' }} />
                      <strong>Mutual Accept Rate</strong>
                    </Box>
                  </TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(mutualAccept[k])}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <TrendingUp sx={{ mr: 1, fontSize: 'small' }} />
                      <strong>Chat Start Rate</strong>
                    </Box>
                  </TableCell>
                  {kValues.map(k => (
                    <TableCell key={k} align="right">{formatValue(chatStart[k])}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {metrics.timestamp && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </Typography>
        )}

        {evaluation && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Eval: {evaluation.holdoutStrategy || 'n/a'} ({formatFraction(evaluation.holdoutFraction)} holdout),{' '}
            agg={evaluation.aggregation || 'n/a'}, denom={evaluation.precisionDenominator || 'n/a'}
            {evaluation.averageHoldoutSize !== undefined && (
              <> - avg_holdout={formatNumber(evaluation.averageHoldoutSize)}</>
            )}
            {evaluation.averageCandidateCount !== undefined && (
              <> - avg_candidates={formatNumber(evaluation.averageCandidateCount)}</>
            )}
          </Typography>
        )}

        {/* Charts Section */}
        <Box mt={3}>
          <MetricsCharts metrics={metrics} title={`${currentAlgorithm} Metrics Trends`} />
        </Box>
      </CardContent>
    </Card>
  );
};
