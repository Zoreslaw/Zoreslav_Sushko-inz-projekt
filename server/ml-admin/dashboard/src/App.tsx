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

function App() {
  return (
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

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Grid container spacing={3}>
            {/* Top Section - Stats */}
            <Grid size={12}>
              <StatsCard />
            </Grid>

            {/* Middle Section - Model Info and Service Status */}
            <Grid size={{ xs: 12, md: 6 }}>
              <ModelInfoCard />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MLServiceStatus />
            </Grid>

            {/* Training Control */}
            <Grid size={12}>
              <TrainingControl />
            </Grid>

            {/* Training Logs */}
            <Grid size={12}>
              <TrainingLogs />
            </Grid>
          </Grid>

          <Box mt={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              TeamUp ML Admin Dashboard © 2025
            </Typography>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
