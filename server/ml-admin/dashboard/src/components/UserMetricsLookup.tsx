import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Skeleton,
} from '@mui/material';
import { Assessment, ManageSearch } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

type MetricsMap = Record<number, number>;

type MetricsResponse = {
  userId?: string;
  UserId?: string;
  algorithm?: string;
  Algorithm?: string;
  timestamp?: string;
  Timestamp?: string;
  PrecisionAtK?: MetricsMap;
  RecallAtK?: MetricsMap;
  NDCGAtK?: MetricsMap;
  HitRateAtK?: MetricsMap;
  MutualAcceptRateAtK?: MetricsMap;
  ChatStartRateAtK?: MetricsMap;
  precisionAtK?: MetricsMap;
  recallAtK?: MetricsMap;
  ndcgAtK?: MetricsMap;
  hitRateAtK?: MetricsMap;
  mutualAcceptRateAtK?: MetricsMap;
  chatStartRateAtK?: MetricsMap;
  evaluation?: Record<string, any>;
};

const kOptions = [5, 10, 20, 50];

const pickMetric = (data: MetricsResponse | null, keys: Array<keyof MetricsResponse>) => {
  if (!data) return {};
  for (const key of keys) {
    const value = data[key];
    if (value && typeof value === 'object') {
      return value as MetricsMap;
    }
  }
  return {};
};

const formatPercent = (value?: number) => {
  if (value === undefined) return '-';
  return `${(value * 100).toFixed(2)}%`;
};

export const UserMetricsLookup: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [kValues, setKValues] = useState<number[]>([5, 10, 20]);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!userId.trim()) {
      setError('Enter a user id to calculate metrics.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await mlAdminApi.calculateUserMetrics(userId.trim(), kValues);
      setData(response);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to calculate metrics');
    } finally {
      setLoading(false);
    }
  };

  const precision = useMemo(() => pickMetric(data, ['PrecisionAtK', 'precisionAtK']), [data]);
  const recall = useMemo(() => pickMetric(data, ['RecallAtK', 'recallAtK']), [data]);
  const ndcg = useMemo(() => pickMetric(data, ['NDCGAtK', 'ndcgAtK']), [data]);
  const hitRate = useMemo(() => pickMetric(data, ['HitRateAtK', 'hitRateAtK']), [data]);
  const mutualAccept = useMemo(
    () => pickMetric(data, ['MutualAcceptRateAtK', 'mutualAcceptRateAtK']),
    [data]
  );
  const chatStart = useMemo(
    () => pickMetric(data, ['ChatStartRateAtK', 'chatStartRateAtK']),
    [data]
  );
  const resolvedUser = data?.UserId ?? data?.userId ?? userId;
  const resolvedAlgorithm = data?.Algorithm ?? data?.algorithm ?? 'n/a';
  const resolvedTimestamp = data?.Timestamp ?? data?.timestamp;

  return (
    <Card>
      <CardHeader
        title="User Metrics Lab"
        subheader="Run a targeted evaluation for a single user"
        avatar={<ManageSearch />}
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              fullWidth
              label="User ID"
              placeholder="e.g. 7b9d..."
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
            <ToggleButtonGroup
              color="primary"
              value={kValues}
              onChange={(_, values) => values && values.length && setKValues(values)}
              size="small"
            >
              {kOptions.map((value) => (
                <ToggleButton key={value} value={value}>
                  @{value}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="contained"
              onClick={handleSubmit}
              startIcon={<Assessment />}
              disabled={loading}
              sx={{ minWidth: 160 }}
            >
              {loading ? 'Running...' : 'Calculate'}
            </Button>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {loading && !data && (
            <Stack spacing={1}>
              <Skeleton variant="text" width="35%" />
              <Skeleton variant="rounded" height={120} />
            </Stack>
          )}

          {data && (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`User: ${resolvedUser}`} color="primary" size="small" />
                <Chip label={`Algorithm: ${resolvedAlgorithm}`} size="small" variant="outlined" />
                <Chip
                  label={`Updated: ${
                    resolvedTimestamp ? new Date(resolvedTimestamp).toLocaleString() : 'n/a'
                  }`}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <Divider />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Recommendation Quality
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      {kValues.map((k) => (
                        <TableCell key={k} align="right">
                          @{k}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { label: 'Precision', values: precision },
                      { label: 'Recall', values: recall },
                      { label: 'NDCG', values: ndcg },
                      { label: 'Hit Rate', values: hitRate },
                      { label: 'Mutual Accept Rate', values: mutualAccept },
                      { label: 'Chat Start Rate', values: chatStart },
                    ].map((row) => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        {kValues.map((k) => (
                          <TableCell key={`${row.label}-${k}`} align="right">
                            {formatPercent(row.values?.[k])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
