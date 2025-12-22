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
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  InputAdornment,
  IconButton,
  Paper,
  alpha,
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
  Person,
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
  
  // Admin flow state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adminSteamIdOrUrl, setAdminSteamIdOrUrl] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

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

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await mlAdminApi.getUsers();
      setUsers(data || []);
    } catch (err: any) {
      setUsersError(err?.message ?? 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) ?? null;
  }, [users, selectedUserId]);

  const handleAdminConnect = async () => {
    if (!selectedUserId) {
      setAdminError('Please select a user first');
      return;
    }
    if (!adminSteamIdOrUrl.trim()) {
      setAdminError('Enter a Steam profile URL or SteamID64');
      return;
    }
    try {
      setAdminLoading(true);
      setAdminError(null);
      const response = await mlAdminApi.adminConnectSteam(selectedUserId, adminSteamIdOrUrl.trim());
      setAdminMessage(`Steam connected for ${response.displayName || selectedUser?.displayName || 'user'}`);
      setAdminSteamIdOrUrl('');
      await loadUsers();
      // Refresh selected user data
      const updated = await mlAdminApi.getUser(selectedUserId);
      if (updated) {
        const userIndex = users.findIndex((u) => u.id === selectedUserId);
        if (userIndex >= 0) {
          const updatedUsers = [...users];
          updatedUsers[userIndex] = updated;
          setUsers(updatedUsers);
        }
      }
    } catch (err: any) {
      setAdminError(err?.message ?? 'Failed to connect Steam');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminSync = async () => {
    if (!selectedUserId) {
      setAdminError('Please select a user first');
      return;
    }
    try {
      setAdminLoading(true);
      setAdminError(null);
      const response = await mlAdminApi.adminSyncSteam(selectedUserId);
      setAdminMessage(`Steam synced for ${response.displayName || selectedUser?.displayName || 'user'}`);
      await loadUsers();
      // Refresh selected user data
      const updated = await mlAdminApi.getUser(selectedUserId);
      if (updated) {
        const userIndex = users.findIndex((u) => u.id === selectedUserId);
        if (userIndex >= 0) {
          const updatedUsers = [...users];
          updatedUsers[userIndex] = updated;
          setUsers(updatedUsers);
        }
      }
    } catch (err: any) {
      setAdminError(err?.message ?? 'Failed to sync Steam');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminDisconnect = async () => {
    if (!selectedUserId) {
      setAdminError('Please select a user first');
      return;
    }
    try {
      setAdminLoading(true);
      setAdminError(null);
      const response = await mlAdminApi.adminDisconnectSteam(selectedUserId);
      setAdminMessage(`Steam disconnected for ${response.displayName || selectedUser?.displayName || 'user'}`);
      await loadUsers();
      // Refresh selected user data
      const updated = await mlAdminApi.getUser(selectedUserId);
      if (updated) {
        const userIndex = users.findIndex((u) => u.id === selectedUserId);
        if (userIndex >= 0) {
          const updatedUsers = [...users];
          updatedUsers[userIndex] = updated;
          setUsers(updatedUsers);
        }
      }
    } catch (err: any) {
      setAdminError(err?.message ?? 'Failed to disconnect Steam');
    } finally {
      setAdminLoading(false);
    }
  };

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
            subheader="Connect, sync, and verify Steam profiles for any user"
            avatar={<Shield />}
            action={
              <Button
                size="small"
                startIcon={<CloudSync />}
                onClick={loadUsers}
                sx={{ textTransform: 'none' }}
              >
                Refresh Users
              </Button>
            }
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: 600,
                    overflow: 'auto',
                    background: (theme) =>
                      `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.04)}, ${alpha(
                        theme.palette.secondary.main,
                        0.02
                      )})`,
                  }}
                >
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Select User
                    </Typography>
                    {usersLoading ? (
                      <Stack spacing={1}>
                        <Skeleton variant="rounded" height={72} />
                        <Skeleton variant="rounded" height={72} />
                        <Skeleton variant="rounded" height={72} />
                      </Stack>
                    ) : usersError ? (
                      <Alert severity="error">{usersError}</Alert>
                    ) : users.length === 0 ? (
                      <Alert severity="info">No users found</Alert>
                    ) : (
                      <List dense>
                        {users.map((user) => {
                          const hasSteam = Boolean(user.steamId || user.steamProfileUrl);
                          return (
                            <ListItem key={user.id} disablePadding>
                              <ListItemButton
                                selected={user.id === selectedUserId}
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setAdminError(null);
                                  setAdminMessage(null);
                                }}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                              >
                                <ListItemAvatar>
                                  <Avatar
                                    src={user.photoUrl || user.steamAvatarUrl || undefined}
                                    sx={{
                                      bgcolor: hasSteam
                                        ? (theme) => alpha(theme.palette.success.main, 0.12)
                                        : (theme) => alpha(theme.palette.grey[500], 0.12),
                                    }}
                                  >
                                    {user.displayName?.[0] || user.email?.[0] || 'U'}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="body2" fontWeight={600}>
                                        {user.displayName || user.email || 'Unknown'}
                                      </Typography>
                                      {hasSteam && (
                                        <Chip
                                          icon={<SportsEsports />}
                                          label="Steam"
                                          size="small"
                                          color="success"
                                          sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                      )}
                                    </Stack>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {user.email || user.id}
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </Stack>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                {!selectedUserId ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      background: (theme) =>
                        `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.04)}, ${alpha(
                          theme.palette.secondary.main,
                          0.02
                        )})`,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        mb: 2,
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                      }}
                    >
                      <Person fontSize="large" />
                    </Avatar>
                    <Typography variant="h6" gutterBottom>
                      Select a user
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Choose a user from the list to connect or manage their Steam account
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={2}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        background: (theme) =>
                          `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(
                            theme.palette.secondary.main,
                            0.04
                          )})`,
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          src={selectedUser?.photoUrl || selectedUser?.steamAvatarUrl || undefined}
                          sx={{ width: 56, height: 56 }}
                        >
                          {selectedUser?.displayName?.[0] || selectedUser?.email?.[0] || 'U'}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6">
                            {selectedUser?.displayName || selectedUser?.email || 'Unknown User'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedUser?.email || selectedUser?.id}
                          </Typography>
                        </Box>
                        {selectedUser?.steamId && (
                          <Chip
                            icon={<SportsEsports />}
                            label="Steam Connected"
                            color="success"
                            size="small"
                          />
                        )}
                      </Stack>
                    </Paper>

                    {selectedUser?.steamId ? (
                      <>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={2}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Steam Profile Details
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Steam ID
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {selectedUser.steamId || 'n/a'}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Display Name
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {selectedUser.steamDisplayName || 'n/a'}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Games
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {selectedUser.steamGames?.length ?? 0}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Categories
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {selectedUser.steamCategories?.length ?? 0}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Last Sync
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {selectedUser.steamLastSyncedAt
                                    ? new Date(selectedUser.steamLastSyncedAt).toLocaleString()
                                    : 'n/a'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Stack>
                        </Paper>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <Button
                            variant="contained"
                            startIcon={<SyncAlt />}
                            onClick={handleAdminSync}
                            disabled={adminLoading}
                            fullWidth
                          >
                            Sync Steam
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<PowerSettingsNew />}
                            onClick={handleAdminDisconnect}
                            disabled={adminLoading}
                            fullWidth
                          >
                            Disconnect
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      <>
                        <TextField
                          label="Steam Profile URL or SteamID64"
                          value={adminSteamIdOrUrl}
                          onChange={(event) => setAdminSteamIdOrUrl(event.target.value)}
                          placeholder="https://steamcommunity.com/id/... or SteamID64"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LinkIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          fullWidth
                        />
                        <Button
                          variant="contained"
                          startIcon={<SportsEsports />}
                          onClick={handleAdminConnect}
                          disabled={adminLoading || !adminSteamIdOrUrl.trim()}
                          fullWidth
                          size="large"
                        >
                          Connect Steam Account
                        </Button>
                      </>
                    )}

                    {adminError && <Alert severity="error">{adminError}</Alert>}
                    {adminMessage && <Alert severity="success">{adminMessage}</Alert>}
                  </Stack>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
