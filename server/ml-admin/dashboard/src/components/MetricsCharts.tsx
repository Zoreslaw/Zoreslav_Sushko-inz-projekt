import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
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

interface MetricsChartsProps {
  metrics: MetricsData;
  title?: string;
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({ metrics, title = 'Metrics Visualization' }) => {
  const kValues = [5, 10, 20];

  // Prepare data for charts
  const recommendationData = kValues.map(k => ({
    k: `@${k}`,
    Precision: (metrics.avgPrecisionAtK?.[k] || 0) * 100,
    Recall: (metrics.avgRecallAtK?.[k] || 0) * 100,
    NDCG: (metrics.avgNDCGAtK?.[k] || 0) * 100,
    'Hit Rate': (metrics.avgHitRateAtK?.[k] || 0) * 100,
  }));

  const productData = kValues.map(k => ({
    k: `@${k}`,
    'Mutual Accept': (metrics.avgMutualAcceptRateAtK?.[k] || 0) * 100,
    'Chat Start': (metrics.avgChatStartRateAtK?.[k] || 0) * 100,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" gutterBottom>
              Recommendation Metrics
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={recommendationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" />
                <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                <Legend />
                <Line type="monotone" dataKey="Precision" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="Recall" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" dataKey="NDCG" stroke="#ffc658" strokeWidth={2} />
                <Line type="monotone" dataKey="Hit Rate" stroke="#ff7300" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" gutterBottom>
              Product Metrics
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" />
                <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value} />
                <Legend />
                <Bar dataKey="Mutual Accept" fill="#8884d8" />
                <Bar dataKey="Chat Start" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

