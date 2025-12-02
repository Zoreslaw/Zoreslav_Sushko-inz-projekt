import React from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  AppBar,
  Toolbar,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';
import { Psychology } from '@mui/icons-material';
import { ModelInfoCard } from './components/ModelInfoCard';
import { StatsCard } from './components/StatsCard';
import { TrainingControl } from './components/TrainingControl';
import { TrainingLogs } from './components/TrainingLogs';
import { MLServiceStatus } from './components/MLServiceStatus';
import { CBServiceStatus } from './components/CBServiceStatus';
import { AlgorithmSelector } from './components/AlgorithmSelector';
import { MetricsCard } from './components/MetricsCard';
import { MetricsComparison } from './components/MetricsComparison';
import { DataGenerator } from './components/DataGenerator';
import { DatasetUploader } from './components/DatasetUploader';
import { AlgorithmProvider, useAlgorithm } from './contexts/AlgorithmContext';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

const AppContent: React.FC = () => {
  const { currentAlgorithm } = useAlgorithm();
  const isContentBased = currentAlgorithm === 'ContentBased';

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Top Section - Stats */}
        <Grid size={12}>
          <StatsCard />
        </Grid>

        {/* Algorithm Selection */}
        <Grid size={12}>
          <AlgorithmSelector />
        </Grid>

        {/* Middle Section - Model Info and Service Status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ModelInfoCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {isContentBased ? <CBServiceStatus /> : <MLServiceStatus />}
        </Grid>

        {/* Training Control - Only show for TwoTower */}
        {!isContentBased && (
          <Grid size={12}>
            <TrainingControl />
          </Grid>
        )}

        {/* Training Logs - Only show for TwoTower */}
        {!isContentBased && (
          <Grid size={12}>
            <TrainingLogs />
          </Grid>
        )}

        {/* Data Generator */}
        <Grid size={12}>
          <DataGenerator />
        </Grid>

        {/* Dataset Uploader */}
        <Grid size={12}>
          <DatasetUploader />
        </Grid>

        {/* Metrics Section */}
        <Grid size={12}>
          <MetricsCard />
        </Grid>

        {/* Metrics Comparison */}
        <Grid size={12}>
          <MetricsComparison />
        </Grid>
      </Grid>

      <Box mt={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          TeamUp ML Admin Dashboard © 2025
        </Typography>
      </Box>
    </Container>
  );
};

function App() {
  return (
    <AlgorithmProvider>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Psychology sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              TeamUp ML Admin Dashboard
            </Typography>
            <Typography variant="body2" color="inherit">
              v1.0.0
            </Typography>
          </Toolbar>
        </AppBar>

          <AppContent />
      </Box>
    </ThemeProvider>
    </AlgorithmProvider>
  );
}

export default App;
