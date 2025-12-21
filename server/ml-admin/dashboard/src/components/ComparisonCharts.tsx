import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MetricsData {
  avgPrecisionAtK?: Record<number, number>;
  avgRecallAtK?: Record<number, number>;
  avgNDCGAtK?: Record<number, number>;
  avgHitRateAtK?: Record<number, number>;
  avgMutualAcceptRateAtK?: Record<number, number>;
  avgChatStartRateAtK?: Record<number, number>;
}

interface ComparisonChartsProps {
  mlMetrics?: MetricsData | null;
  cbMetrics?: MetricsData | null;
  hybridMetrics?: MetricsData | null;
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ mlMetrics, cbMetrics, hybridMetrics }) => {
  const [tabValue, setTabValue] = React.useState(0);
  const kValues = [5, 10, 20];
  const hasMl = !!mlMetrics;
  const hasCb = !!cbMetrics;
  const hasHybrid = !!hybridMetrics;

  // Prepare data for recommendation metrics charts
  const recommendationData = kValues.map(k => {
    const point: Record<string, number | string> = { k: `@${k}` };
    if (hasMl) {
      point['TwoTower Precision'] = (mlMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
      point['TwoTower Recall'] = (mlMetrics!.avgRecallAtK?.[k] || 0) * 100;
      point['TwoTower NDCG'] = (mlMetrics!.avgNDCGAtK?.[k] || 0) * 100;
      point['TwoTower Hit Rate'] = (mlMetrics!.avgHitRateAtK?.[k] || 0) * 100;
    }
    if (hasCb) {
      point['ContentBased Precision'] = (cbMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
      point['ContentBased Recall'] = (cbMetrics!.avgRecallAtK?.[k] || 0) * 100;
      point['ContentBased NDCG'] = (cbMetrics!.avgNDCGAtK?.[k] || 0) * 100;
      point['ContentBased Hit Rate'] = (cbMetrics!.avgHitRateAtK?.[k] || 0) * 100;
    }
    if (hasHybrid) {
      point['Hybrid Precision'] = (hybridMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
      point['Hybrid Recall'] = (hybridMetrics!.avgRecallAtK?.[k] || 0) * 100;
      point['Hybrid NDCG'] = (hybridMetrics!.avgNDCGAtK?.[k] || 0) * 100;
      point['Hybrid Hit Rate'] = (hybridMetrics!.avgHitRateAtK?.[k] || 0) * 100;
    }
    return point;
  });

  // Prepare data for product metrics charts
  const productData = kValues.map(k => {
    const point: Record<string, number | string> = { k: `@${k}` };
    if (hasMl) {
      point['TwoTower Mutual Accept'] = (mlMetrics!.avgMutualAcceptRateAtK?.[k] || 0) * 100;
      point['TwoTower Chat Start'] = (mlMetrics!.avgChatStartRateAtK?.[k] || 0) * 100;
    }
    if (hasCb) {
      point['ContentBased Mutual Accept'] = (cbMetrics!.avgMutualAcceptRateAtK?.[k] || 0) * 100;
      point['ContentBased Chat Start'] = (cbMetrics!.avgChatStartRateAtK?.[k] || 0) * 100;
    }
    if (hasHybrid) {
      point['Hybrid Mutual Accept'] = (hybridMetrics!.avgMutualAcceptRateAtK?.[k] || 0) * 100;
      point['Hybrid Chat Start'] = (hybridMetrics!.avgChatStartRateAtK?.[k] || 0) * 100;
    }
    return point;
  });

  // Prepare grouped bar chart data
  const precisionData = kValues.map(k => {
    const point: Record<string, number | string> = { k: `@${k}` };
    if (hasMl) point.TwoTower = (mlMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
    if (hasCb) point.ContentBased = (cbMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
    if (hasHybrid) point.Hybrid = (hybridMetrics!.avgPrecisionAtK?.[k] || 0) * 100;
    return point;
  });

  const recallData = kValues.map(k => {
    const point: Record<string, number | string> = { k: `@${k}` };
    if (hasMl) point.TwoTower = (mlMetrics!.avgRecallAtK?.[k] || 0) * 100;
    if (hasCb) point.ContentBased = (cbMetrics!.avgRecallAtK?.[k] || 0) * 100;
    if (hasHybrid) point.Hybrid = (hybridMetrics!.avgRecallAtK?.[k] || 0) * 100;
    return point;
  });

  const ndcgData = kValues.map(k => {
    const point: Record<string, number | string> = { k: `@${k}` };
    if (hasMl) point.TwoTower = (mlMetrics!.avgNDCGAtK?.[k] || 0) * 100;
    if (hasCb) point.ContentBased = (cbMetrics!.avgNDCGAtK?.[k] || 0) * 100;
    if (hasHybrid) point.Hybrid = (hybridMetrics!.avgNDCGAtK?.[k] || 0) * 100;
    return point;
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Algorithm Comparison Charts
        </Typography>

        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
          <Tab label="Recommendation Metrics" />
          <Tab label="Product Metrics" />
          <Tab label="Side-by-Side Comparison" />
        </Tabs>

        {tabValue === 0 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Precision@K Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={recommendationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Line type="monotone" dataKey="TwoTower Precision" stroke="#8884d8" strokeWidth={2} />}
                  {hasCb && <Line type="monotone" dataKey="ContentBased Precision" stroke="#82ca9d" strokeWidth={2} />}
                  {hasHybrid && <Line type="monotone" dataKey="Hybrid Precision" stroke="#00a870" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recall@K Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={recommendationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Line type="monotone" dataKey="TwoTower Recall" stroke="#8884d8" strokeWidth={2} />}
                  {hasCb && <Line type="monotone" dataKey="ContentBased Recall" stroke="#82ca9d" strokeWidth={2} />}
                  {hasHybrid && <Line type="monotone" dataKey="Hybrid Recall" stroke="#00a870" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                NDCG@K Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={recommendationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Line type="monotone" dataKey="TwoTower NDCG" stroke="#8884d8" strokeWidth={2} />}
                  {hasCb && <Line type="monotone" dataKey="ContentBased NDCG" stroke="#82ca9d" strokeWidth={2} />}
                  {hasHybrid && <Line type="monotone" dataKey="Hybrid NDCG" stroke="#00a870" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Hit Rate@K Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={recommendationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Line type="monotone" dataKey="TwoTower Hit Rate" stroke="#8884d8" strokeWidth={2} />}
                  {hasCb && <Line type="monotone" dataKey="ContentBased Hit Rate" stroke="#82ca9d" strokeWidth={2} />}
                  {hasHybrid && <Line type="monotone" dataKey="Hybrid Hit Rate" stroke="#00a870" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Mutual Accept Rate@K
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Bar dataKey="TwoTower Mutual Accept" fill="#8884d8" />}
                  {hasCb && <Bar dataKey="ContentBased Mutual Accept" fill="#82ca9d" />}
                  {hasHybrid && <Bar dataKey="Hybrid Mutual Accept" fill="#00a870" />}
                </BarChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Chat Start Rate@K
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Bar dataKey="TwoTower Chat Start" fill="#8884d8" />}
                  {hasCb && <Bar dataKey="ContentBased Chat Start" fill="#82ca9d" />}
                  {hasHybrid && <Bar dataKey="Hybrid Chat Start" fill="#00a870" />}
                </BarChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        )}

        {tabValue === 2 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Precision@K
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={precisionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Bar dataKey="TwoTower" fill="#8884d8" />}
                  {hasCb && <Bar dataKey="ContentBased" fill="#82ca9d" />}
                  {hasHybrid && <Bar dataKey="Hybrid" fill="#00a870" />}
                </BarChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recall@K
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={recallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Bar dataKey="TwoTower" fill="#8884d8" />}
                  {hasCb && <Bar dataKey="ContentBased" fill="#82ca9d" />}
                  {hasHybrid && <Bar dataKey="Hybrid" fill="#00a870" />}
                </BarChart>
              </ResponsiveContainer>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                NDCG@K
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ndcgData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  {hasMl && <Bar dataKey="TwoTower" fill="#8884d8" />}
                  {hasCb && <Bar dataKey="ContentBased" fill="#82ca9d" />}
                  {hasHybrid && <Bar dataKey="Hybrid" fill="#00a870" />}
                </BarChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

