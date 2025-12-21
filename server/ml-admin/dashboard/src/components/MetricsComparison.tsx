import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Skeleton,
  Stack,
} from '@mui/material';
import { CompareArrows } from '@mui/icons-material';
import { mlAdminApi, MetricsEvaluationMetadata } from '../api/mlAdminApi';
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
  evaluation?: MetricsEvaluationMetadata;
}

export const MetricsComparison: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MetricsData | null>(null);
  const [cbMetrics, setCbMetrics] = useState<MetricsData | null>(null);
  const [hybridMetrics, setHybridMetrics] = useState<MetricsData | null>(null);
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
          setHybridMetrics(comparison.Hybrid || null);
        } else {
          // Fallback to separate calls if comparison endpoint fails
          const [ml, cb, hybrid] = await Promise.all([
            mlAdminApi.getAggregateMetrics('TwoTower', kValues).catch(() => null),
            mlAdminApi.getAggregateMetrics('ContentBased', kValues).catch(() => null),
            mlAdminApi.getAggregateMetrics('Hybrid', kValues).catch(() => null),
          ]);
          setMlMetrics(ml);
          setCbMetrics(cb);
          setHybridMetrics(hybrid);
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
          <Stack spacing={2}>
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="rounded" height={140} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error || (!mlMetrics && !cbMetrics && !hybridMetrics)) {
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

  const getBest = (ml: number | undefined, cb: number | undefined, hybrid: number | undefined) => {
    const candidates = [
      { key: 'ml', val: ml },
      { key: 'cb', val: cb },
      { key: 'hybrid', val: hybrid },
    ].filter((item) => item.val !== undefined) as { key: string; val: number }[];
    if (candidates.length === 0) return null;
    const maxVal = Math.max(...candidates.map((c) => c.val));
    const winners = candidates.filter((c) => c.val === maxVal).map((c) => c.key);
    if (winners.length !== 1) return 'tie';
    return winners[0];
  };

  const formatFraction = (val: number | undefined) => {
    if (val === undefined) return '-';
    return `${(val * 100).toFixed(0)}%`;
  };
  const formatNumber = (val: number | undefined) => {
    if (val === undefined) return '-';
    return val.toFixed(1);
  };

  const evaluation = mlMetrics?.evaluation || cbMetrics?.evaluation || hybridMetrics?.evaluation;

  const metrics = [
    { name: 'Precision', ml: mlMetrics?.avgPrecisionAtK, cb: cbMetrics?.avgPrecisionAtK, hybrid: hybridMetrics?.avgPrecisionAtK },
    { name: 'Recall', ml: mlMetrics?.avgRecallAtK, cb: cbMetrics?.avgRecallAtK, hybrid: hybridMetrics?.avgRecallAtK },
    { name: 'NDCG', ml: mlMetrics?.avgNDCGAtK, cb: cbMetrics?.avgNDCGAtK, hybrid: hybridMetrics?.avgNDCGAtK },
    { name: 'Hit Rate', ml: mlMetrics?.avgHitRateAtK, cb: cbMetrics?.avgHitRateAtK, hybrid: hybridMetrics?.avgHitRateAtK },
    { name: 'Mutual Accept Rate', ml: mlMetrics?.avgMutualAcceptRateAtK, cb: cbMetrics?.avgMutualAcceptRateAtK, hybrid: hybridMetrics?.avgMutualAcceptRateAtK },
    { name: 'Chat Start Rate', ml: mlMetrics?.avgChatStartRateAtK, cb: cbMetrics?.avgChatStartRateAtK, hybrid: hybridMetrics?.avgChatStartRateAtK },
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

        {evaluation && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
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
                <TableCell align="right">
                  <Chip label="Hybrid" color="success" size="small" />
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
                    const hybridVal = metric.hybrid?.[k];
                    const winner = getBest(mlVal, cbVal, hybridVal);
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
                        <TableCell align="right">{formatValue(hybridVal)}</TableCell>
                        <TableCell align="center">
                          {winner === 'ml' && <Chip label="ML" color="primary" size="small" />}
                          {winner === 'cb' && <Chip label="CB" color="secondary" size="small" />}
                          {winner === 'hybrid' && <Chip label="Hybrid" color="success" size="small" />}
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
        {(mlMetrics || cbMetrics || hybridMetrics) && (
          <Box mt={3}>
            <ComparisonCharts mlMetrics={mlMetrics} cbMetrics={cbMetrics} hybridMetrics={hybridMetrics} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
