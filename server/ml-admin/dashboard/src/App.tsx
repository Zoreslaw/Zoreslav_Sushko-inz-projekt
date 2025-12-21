import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
  useMediaQuery,
} from '@mui/material';
import {
  AutoGraph,
  Bolt,
  DashboardCustomize,
  DataUsage,
  Insights,
  GroupAdd,
  Menu as MenuIcon,
  ModelTraining,
  NotificationsNone,
  Psychology,
  Storage,
  SportsEsports,
  SettingsApplications,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { ModelInfoCard } from './components/ModelInfoCard';
import { StatsCard } from './components/StatsCard';
import { TrainingControl } from './components/TrainingControl';
import { MLServiceStatus } from './components/MLServiceStatus';
import { CBServiceStatus } from './components/CBServiceStatus';
import { AlgorithmSelector } from './components/AlgorithmSelector';
import { MetricsCard } from './components/MetricsCard';
import { MetricsComparison } from './components/MetricsComparison';
import { DataGenerator } from './components/DataGenerator';
import { DatasetUploader } from './components/DatasetUploader';
import { ModelHistory } from './components/ModelHistory';
import { OperationsOverview } from './components/OperationsOverview';
import { UserMetricsLookup } from './components/UserMetricsLookup';
import { SteamStatus } from './components/SteamStatus';
import { UserManagement } from './components/UserManagement';
import { AlgorithmProvider, useAlgorithm } from './contexts/AlgorithmContext';
import heroOverview from './assets/hero-overview.svg';
import heroTraining from './assets/hero-training.svg';
import heroData from './assets/hero-data.svg';
import heroMetrics from './assets/hero-metrics.svg';
import heroModels from './assets/hero-models.svg';
import heroSteam from './assets/hero-steam.svg';
import heroUsers from './assets/hero-users.svg';

const drawerWidth = 260;

const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b4dff',
    },
    secondary: {
      main: '#ff8f00',
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    success: {
      main: '#00a870',
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', 'Segoe UI', sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
        },
      },
    },
  },
});

type PageId = 'overview' | 'training' | 'data' | 'metrics' | 'models' | 'steam' | 'users';

type PageConfig = {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  heroImage: string;
};

const PageHero: React.FC<{
  title: string;
  subtitle: string;
  heroImage: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, heroImage, actions }) => {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        color: 'common.white',
        background: `linear-gradient(120deg, ${alpha(
          theme.palette.primary.main,
          0.95
        )}, ${alpha(theme.palette.secondary.main, 0.88)})`,
      }}
    >
      <Grid container spacing={3} alignItems="center">
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="h4" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ color: alpha('#ffffff', 0.82) }}>
            {subtitle}
          </Typography>
          {actions && (
            <Stack direction="row" spacing={2} mt={3} flexWrap="wrap">
              {actions}
            </Stack>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box
            component="img"
            src={heroImage}
            alt=""
            sx={{
              width: '100%',
              borderRadius: 2,
              border: `1px solid ${alpha('#ffffff', 0.3)}`,
              boxShadow: '0 20px 35px rgba(15, 23, 42, 0.25)',
            }}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

const AppContent: React.FC = () => {
  const { currentAlgorithm } = useAlgorithm();
  const isContentBased = currentAlgorithm === 'ContentBased';
  const isHybrid = currentAlgorithm === 'Hybrid';
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePage, setActivePage] = useState<PageId>('overview');

  const pages: PageConfig[] = useMemo(
    () => [
      {
        id: 'overview',
        label: 'Overview',
        icon: <DashboardCustomize />,
        title: 'Operational Overview',
        subtitle: 'High-level status for services, data, and the active algorithm.',
        heroImage: heroOverview,
      },
      {
        id: 'training',
        label: 'Training Ops',
        icon: <ModelTraining />,
        title: 'Training Operations',
        subtitle: 'Schedule, trigger, and monitor model training in real time.',
        heroImage: heroTraining,
      },
      {
        id: 'data',
        label: 'Data Pipelines',
        icon: <DataUsage />,
        title: 'Data Pipelines',
        subtitle: 'Feed the system with fresh interactions and datasets.',
        heroImage: heroData,
      },
      {
        id: 'metrics',
        label: 'Metrics Lab',
        icon: <Insights />,
        title: 'Metrics Lab',
        subtitle: 'Track aggregate performance and drill into user-level diagnostics.',
        heroImage: heroMetrics,
      },
      {
        id: 'users',
        label: 'User Ops',
        icon: <GroupAdd />,
        title: 'User Operations',
        subtitle: 'Create users, manage interactions, and clean up datasets with clarity.',
        heroImage: heroUsers,
      },
      {
        id: 'models',
        label: 'Model Vault',
        icon: <Storage />,
        title: 'Model Vault',
        subtitle: 'Version history, activation workflows, and performance lineage.',
        heroImage: heroModels,
      },
      {
        id: 'steam',
        label: 'Steam API',
        icon: <SportsEsports />,
        title: 'Steam API Status',
        subtitle: 'Validate catalog endpoints and monitor Steam connectivity.',
        heroImage: heroSteam,
      },
    ],
    []
  );

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '') as PageId;
      const target = pages.find((page) => page.id === hash);
      setActivePage(target?.id ?? 'overview');
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [pages]);

  const handlePageChange = (id: PageId) => {
    setActivePage(id);
    window.location.hash = id;
    if (!isMdUp) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            <Psychology fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="subtitle1">TeamUp ML</Typography>
            <Typography variant="caption" color="text.secondary">
              Admin Console
            </Typography>
          </Box>
        </Stack>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {pages.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              selected={activePage === item.id}
              onClick={() => handlePageChange(item.id)}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ mt: 'auto' }}>
        <Box
          sx={{
            p: 2,
            width: '100%',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          }}
        >
          <Stack spacing={1}>
            <Typography variant="subtitle2">System Mode</Typography>
            <Chip
              icon={<Bolt />}
              label="Live monitoring"
              color="success"
              size="small"
              sx={{ width: 'fit-content' }}
            />
            <Typography variant="caption" color="text.secondary">
              All telemetry is streaming in real time.
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );

  const pageMeta = pages.find((page) => page.id === activePage) ?? pages[0];

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: `radial-gradient(circle at top, ${alpha(
          theme.palette.primary.main,
          0.08
        )}, transparent 45%)`,
      }}
    >
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)`,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          {!isMdUp && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexGrow: 1 }}>
            <Avatar sx={{ bgcolor: alpha('#ffffff', 0.2), width: 36, height: 36 }}>
              <SettingsApplications fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="subtitle1">ML Operations Dashboard</Typography>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.7) }}>
                {pageMeta.label} workspace
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`Algorithm: ${currentAlgorithm}`}
              size="small"
              variant="outlined"
              sx={{ color: 'common.white', borderColor: alpha('#ffffff', 0.4) }}
            />
            <Chip icon={<Bolt />} label="Live" size="small" color="success" />
            <IconButton color="inherit">
              <Badge color="warning" variant="dot">
                <NotificationsNone />
              </Badge>
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMdUp ? 'permanent' : 'temporary'}
          open={isMdUp ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(15, 23, 42, 0.08)',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 4 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />

        <Container maxWidth="xl">
          <Stack spacing={4}>
            <PageHero
              title={pageMeta.title}
              subtitle={pageMeta.subtitle}
              heroImage={pageMeta.heroImage}
              actions={
                activePage === 'training' ? (
                  <>
                    <Button
                      variant="contained"
                      color="inherit"
                      onClick={() => handlePageChange('training')}
                      sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'common.white' }}
                    >
                      Review training
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => handlePageChange('metrics')}
                      sx={{ borderColor: alpha('#ffffff', 0.6), color: 'common.white' }}
                    >
                      Compare metrics
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      color="inherit"
                      onClick={() => handlePageChange('overview')}
                      sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'common.white' }}
                    >
                      Open overview
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => handlePageChange('steam')}
                      sx={{ borderColor: alpha('#ffffff', 0.6), color: 'common.white' }}
                    >
                      Check Steam API
                    </Button>
                  </>
                )
              }
            />

            {activePage === 'overview' && (
              <Stack spacing={3}>
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <StatsCard />
                  </Grid>
                  <Grid size={12}>
                    <AlgorithmSelector />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ModelInfoCard />
                  </Grid>
                  {isHybrid ? (
                    <>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <MLServiceStatus />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <CBServiceStatus />
                      </Grid>
                    </>
                  ) : (
                    <Grid size={{ xs: 12, md: 6 }}>
                      {isContentBased ? <CBServiceStatus /> : <MLServiceStatus />}
                    </Grid>
                  )}
                </Grid>
              </Stack>
            )}

            {activePage === 'training' && (
              <Grid container spacing={3}>
                {!isContentBased && (
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <TrainingControl />
                  </Grid>
                )}
                <Grid size={{ xs: 12, lg: isContentBased ? 12 : 5 }}>
                  <OperationsOverview />
                </Grid>
              </Grid>
            )}

            {activePage === 'data' && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <DataGenerator />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <DatasetUploader />
                </Grid>
              </Grid>
            )}

            {activePage === 'metrics' && (
              <Grid container spacing={3}>
                <Grid size={12}>
                  <MetricsCard />
                </Grid>
                <Grid size={12}>
                  <UserMetricsLookup />
                </Grid>
                <Grid size={12}>
                  <MetricsComparison />
                </Grid>
              </Grid>
            )}

            {activePage === 'users' && (
              <Grid container spacing={3}>
                <Grid size={12}>
                  <UserManagement />
                </Grid>
              </Grid>
            )}

            {activePage === 'models' && (
              <Grid container spacing={3}>
                <Grid size={12}>
                  {!isContentBased ? (
                    <ModelHistory />
                  ) : (
                    <Paper sx={{ p: 3 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Model history is unavailable for Content-Based mode.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Switch to TwoTower to browse, activate, or upload new model versions.
                      </Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            )}

            {activePage === 'steam' && (
              <Grid container spacing={3}>
                <Grid size={12}>
                  <SteamStatus />
                </Grid>
              </Grid>
            )}

            <Box mt={4} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                TeamUp ML Admin Dashboard 2025
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

function App() {
  return (
    <AlgorithmProvider>
      <ThemeProvider theme={appTheme}>
        <AppContent />
      </ThemeProvider>
    </AlgorithmProvider>
  );
}

export default App;
