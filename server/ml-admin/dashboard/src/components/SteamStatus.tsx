import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  CloudSync,
  CheckCircle,
  ErrorOutline,
  Search,
  Link as LinkIcon,
  Shield,
  Visibility,
  VisibilityOff,
  SportsEsports,
  SyncAlt,
  PowerSettingsNew,
} from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

type SteamHealth = {
  status: string;
  latency_ms?: number;
  backend_status?: number;
  error?: string;
  timestamp?: string;
};

export const SteamStatus: React.FC = () => {
  const [health, setHealth] = useState<SteamHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [type, setType] = useState<'games' | 'categories'>('games');
  const [query, setQuery] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [steamIdOrUrl, setSteamIdOrUrl] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const response = await mlAdminApi.getSteamHealth();
      setHealth(response);
      setHealthError(null);
    } catch (err: any) {
      setHealthError(err?.message ?? 'Failed to check Steam connectivity');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);
      const response = await mlAdminApi.getSteamCatalog(type, query.trim());
      setCatalog(response.items ?? []);
    } catch (err: any) {
      setCatalogError(err?.message ?? 'Failed to load catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const normalizedToken = useMemo(() => {
    if (!token.trim()) return '';
    return token.trim().toLowerCase().startsWith('bearer ')
      ? token.trim()
      : `Bearer ${token.trim()}`;
  }, [token]);

  const handleConnect = async () => {
    if (!normalizedToken) {
      setAccountError('Paste a JWT access token to continue.');
      return;
    }
    if (!steamIdOrUrl.trim()) {
      setAccountError('Enter a Steam profile URL or SteamID64.');
      return;
    }
    try {
      setAccountLoading(true);
      setAccountError(null);
      const response = await mlAdminApi.connectSteam(normalizedToken, steamIdOrUrl.trim());
      setProfile(response);
      setAccountMessage('Steam account connected successfully.');
    } catch (err: any) {
      setAccountError(err?.message ?? 'Failed to connect Steam account.');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleSync = async () => {
    if (!normalizedToken) {
      setAccountError('Paste a JWT access token to continue.');
      return;
    }
    try {
      setAccountLoading(true);
      setAccountError(null);
      const response = await mlAdminApi.syncSteam(normalizedToken);
      setProfile(response);
      setAccountMessage('Steam profile synced.');
    } catch (err: any) {
      setAccountError(err?.message ?? 'Failed to sync Steam profile.');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!normalizedToken) {
      setAccountError('Paste a JWT access token to continue.');
      return;
    }
    try {
      setAccountLoading(true);
      setAccountError(null);
      const response = await mlAdminApi.disconnectSteam(normalizedToken);
      setProfile(response);
      setAccountMessage('Steam account disconnected.');
    } catch (err: any) {
      setAccountError(err?.message ?? 'Failed to disconnect Steam account.');
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader
            title="Connectivity"
            subheader="Realtime Steam API status"
            action={
              <Button
                size="small"
                startIcon={<CloudSync />}
                onClick={loadHealth}
                sx={{ textTransform: 'none' }}
              >
                Refresh
              </Button>
            }
          />
          <CardContent>
            {healthLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={26} />
                <Skeleton variant="rounded" height={60} />
                <Skeleton variant="rounded" height={40} />
              </Stack>
            ) : healthError ? (
              <Alert severity="error">{healthError}</Alert>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    icon={health?.status === 'ok' ? <CheckCircle /> : <ErrorOutline />}
                    label={health?.status === 'ok' ? 'Steam reachable' : 'Degraded'}
                    color={health?.status === 'ok' ? 'success' : 'warning'}
                    size="small"
                  />
                  <Chip
                    label={`Latency: ${health?.latency_ms ?? 'n/a'} ms`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Backend response
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    Status code: {health?.backend_status ?? 'n/a'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'n/a'}
                  </Typography>
                </Box>
                {health?.error && <Alert severity="warning">{health.error}</Alert>}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader
            title="Catalog Explorer"
            subheader="Validate Steam catalog search endpoints"
          />
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <ToggleButtonGroup
                  value={type}
                  exclusive
                  onChange={(_, value) => value && setType(value)}
                  size="small"
                >
                  <ToggleButton value="games">Games</ToggleButton>
                  <ToggleButton value="categories">Categories</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  fullWidth
                  label="Search"
                  placeholder="Type to query the Steam catalog"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  variant="contained"
                  startIcon={<Search />}
                  onClick={handleSearch}
                  disabled={catalogLoading}
                >
                  Search
                </Button>
              </Stack>

              {catalogLoading ? (
                <Stack spacing={1}>
                  <Skeleton variant="rounded" height={22} />
                  <Skeleton variant="rounded" height={22} />
                  <Skeleton variant="rounded" height={22} />
                  <Skeleton variant="rounded" height={22} />
                </Stack>
              ) : catalogError ? (
                <Alert severity="error">{catalogError}</Alert>
              ) : (
                <List dense>
                  {catalog.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="No results yet. Run a search to validate the API." />
                    </ListItem>
                  ) : (
                    catalog.slice(0, 8).map((item) => (
                      <ListItem key={item}>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card>
          <CardHeader
            title="Account Flow"
            subheader="Connect, sync, and verify Steam profiles"
            avatar={<Shield />}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={2}>
                  <TextField
                    label="JWT Access Token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    type={showToken ? 'text' : 'password'}
                    placeholder="Paste Bearer token"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Shield fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowToken((prev) => !prev)} edge="end">
                            {showToken ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                  />
                  <TextField
                    label="Steam Profile URL or SteamID64"
                    value={steamIdOrUrl}
                    onChange={(event) => setSteamIdOrUrl(event.target.value)}
                    placeholder="https://steamcommunity.com/id/..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button
                      variant="contained"
                      startIcon={<SportsEsports />}
                      onClick={handleConnect}
                      disabled={accountLoading}
                    >
                      Connect
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SyncAlt />}
                      onClick={handleSync}
                      disabled={accountLoading}
                    >
                      Sync
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<PowerSettingsNew />}
                      onClick={handleDisconnect}
                      disabled={accountLoading}
                    >
                      Disconnect
                    </Button>
                  </Stack>
                  {accountError && <Alert severity="error">{accountError}</Alert>}
                  {accountMessage && <Alert severity="success">{accountMessage}</Alert>}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card variant="outlined" sx={{ p: 2 }}>
                  {accountLoading ? (
                    <Stack spacing={2}>
                      <Skeleton variant="rounded" height={64} />
                      <Skeleton variant="rounded" height={90} />
                      <Skeleton variant="rounded" height={60} />
                    </Stack>
                  ) : profile ? (
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          src={profile.steamAvatarUrl || profile.photoUrl || undefined}
                          sx={{ width: 64, height: 64 }}
                        >
                          {profile.steamDisplayName?.[0] || profile.displayName?.[0] || 'S'}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">
                            {profile.steamDisplayName || profile.displayName || 'Steam Profile'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {profile.steamProfileUrl || 'No profile URL available'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider />
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6, md: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            Steam ID
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.steamId || 'n/a'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6, md: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            Games Imported
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.steamGames?.length ?? 0}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6, md: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            Categories
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.steamCategories?.length ?? 0}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6, md: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            Last Sync
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.steamLastSyncedAt
                              ? new Date(profile.steamLastSyncedAt).toLocaleString()
                              : 'n/a'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="subtitle1">No Steam profile connected</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Provide a token and Steam profile link to test the full connect flow.
                      </Typography>
                    </Stack>
                  )}
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
