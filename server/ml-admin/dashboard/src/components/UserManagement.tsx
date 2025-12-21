import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Grow,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  Add,
  AutoAwesome,
  AutoFixHigh,
  Delete,
  Group,
  GroupAdd,
  Person,
  Refresh,
  RemoveCircle,
  RestartAlt,
  SportsEsports,
  Timeline,
  TrendingUp,
  WarningAmber,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { mlAdminApi } from '../api/mlAdminApi';
import { UserMessagingStudio } from './UserMessagingStudio';

type UserRecord = {
  id: string;
  displayName: string;
  email: string;
  age?: number;
  gender?: string;
  description?: string;
  photoUrl?: string;
  authProvider?: string;
  providerId?: string;
  favoriteCategory?: string;
  preferenceGender?: string;
  preferenceAgeMin?: number;
  preferenceAgeMax?: number;
  favoriteGames?: string[];
  otherGames?: string[];
  languages?: string[];
  preferenceCategories?: string[];
  preferenceLanguages?: string[];
  steamId?: string;
  steamDisplayName?: string;
  steamProfileUrl?: string;
  steamAvatarUrl?: string;
  steamLastSyncedAt?: string;
  steamGames?: string[];
  steamCategories?: string[];
  liked?: string[];
  disliked?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type SegmentId = 'all' | 'new' | 'cold' | 'stale' | 'steam-missing' | 'power';

const dayMs = 24 * 60 * 60 * 1000;

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeStringList = (values?: string[]) =>
  (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const areStringListsEqual = (left?: string[], right?: string[]) => {
  const normalizedLeft = normalizeStringList(left);
  const normalizedRight = normalizeStringList(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const toTimestamp = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const formatDateTime = (value?: string) => {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'n/a' : parsed.toLocaleString();
};

const getInteractionCount = (user: UserRecord) =>
  (user.liked?.length ?? 0) + (user.disliked?.length ?? 0);

const hasSteamProfile = (user: UserRecord) =>
  Boolean(user.steamId || user.steamProfileUrl || user.steamDisplayName);

const getUserHealth = (user: UserRecord, now: number) => {
  const interactions = getInteractionCount(user);
  const interactionScore = Math.min(interactions * 6, 36);
  const profileScore =
    (user.displayName ? 10 : 0) +
    (user.email ? 10 : 0) +
    (user.age ? 4 : 0) +
    (user.gender ? 4 : 0) +
    (user.description ? 4 : 0);
  const steamScore = hasSteamProfile(user) ? 16 : 0;
  const gamesScore = Math.min((user.steamGames?.length ?? 0) * 2, 8);
  const updatedAt = toTimestamp(user.updatedAt);
  let freshnessScore = 0;
  if (updatedAt) {
    const ageDays = (now - updatedAt) / dayMs;
    if (ageDays <= 7) freshnessScore = 20;
    else if (ageDays <= 30) freshnessScore = 12;
    else freshnessScore = 4;
  }
  const total = interactionScore + profileScore + steamScore + gamesScore + freshnessScore;
  return Math.min(100, Math.round(total));
};

const getUserRiskScore = (user: UserRecord, now: number) => {
  const interactions = getInteractionCount(user);
  const updatedAt = toTimestamp(user.updatedAt);
  const isStale = updatedAt ? now - updatedAt >= dayMs * 30 : true;
  const missingSteam = !hasSteamProfile(user);
  let score = 0;
  if (interactions === 0) score += 40;
  else if (interactions < 3) score += 20;
  if (isStale) score += 30;
  if (missingSteam) score += 15;
  if (!user.email) score += 15;
  return Math.min(100, score);
};

const getRiskLabel = (score: number) => {
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
};

const isSegmentMatch = (user: UserRecord, segmentId: SegmentId, now: number) => {
  const interactions = getInteractionCount(user);
  const createdAt = toTimestamp(user.createdAt);
  const updatedAt = toTimestamp(user.updatedAt);
  const isNew = createdAt ? now - createdAt <= dayMs : false;
  const isStale = updatedAt ? now - updatedAt >= dayMs * 30 : true;
  const hasSteam = hasSteamProfile(user);
  const health = getUserHealth(user, now);

  switch (segmentId) {
    case 'new':
      return isNew;
    case 'cold':
      return interactions === 0;
    case 'stale':
      return isStale;
    case 'steam-missing':
      return !hasSteam;
    case 'power':
      return health >= 80;
    case 'all':
    default:
      return true;
  }
};

const personaPresets = [
  {
    id: 'newcomer',
    label: 'Newcomer',
    description: 'Low friction onboarding with broad preferences.',
    values: {
      age: 21,
      gender: 'Unknown',
      preferenceGender: 'Any',
      preferenceAgeMin: 18,
      preferenceAgeMax: 30,
      languages: 'English',
      favoriteGames: 'Stardew Valley, Fall Guys',
      preferenceCategories: 'Casual, Co-op',
    },
  },
  {
    id: 'social',
    label: 'Social spark',
    description: 'High chance of mutual matches and quick chats.',
    values: {
      age: 27,
      gender: 'Unknown',
      preferenceGender: 'Any',
      preferenceAgeMin: 21,
      preferenceAgeMax: 34,
      languages: 'English, Spanish',
      favoriteGames: 'Among Us, Valorant',
      preferenceCategories: 'Party, Competitive',
    },
  },
  {
    id: 'power',
    label: 'Power gamer',
    description: 'Competitive profile with sharper genre focus.',
    values: {
      age: 29,
      gender: 'Unknown',
      preferenceGender: 'Any',
      preferenceAgeMin: 22,
      preferenceAgeMax: 35,
      languages: 'English',
      favoriteGames: 'Apex Legends, Dota 2',
      preferenceCategories: 'Competitive, Team',
    },
  },
];

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [actionTab, setActionTab] = useState(0);
  const [activeSegment, setActiveSegment] = useState<SegmentId>('all');
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState(0);

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    age: 18,
    gender: '',
    description: '',
    photoUrl: '',
    favoriteCategory: '',
    preferenceGender: '',
    preferenceAgeMin: 18,
    preferenceAgeMax: 35,
    favoriteGames: [] as string[],
    otherGames: [] as string[],
    languages: [] as string[],
    preferenceCategories: [] as string[],
    preferenceLanguages: [] as string[],
  });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    displayName: '',
    email: '',
    age: 24,
    gender: 'Unknown',
    preferenceGender: 'Any',
    preferenceAgeMin: 18,
    preferenceAgeMax: 35,
    languages: '',
    favoriteGames: '',
    preferenceCategories: '',
  });
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [presetNote, setPresetNote] = useState<string | null>(null);
  const [randomCount, setRandomCount] = useState(10);
  const [createLoading, setCreateLoading] = useState(false);

  const [likedUsers, setLikedUsers] = useState<UserRecord[]>([]);
  const [dislikedUsers, setDislikedUsers] = useState<UserRecord[]>([]);
  const [replaceMode, setReplaceMode] = useState(true);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactionLoading, setInteractionLoading] = useState(false);

  const [purgeTargetId, setPurgeTargetId] = useState('');
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );
  const sharedGames = useMemo(() => normalizeStringList(selectedUser?.steamGames), [selectedUser]);
  const sharedCategories = useMemo(
    () => normalizeStringList(selectedUser?.steamCategories),
    [selectedUser]
  );

  const aggregates = useMemo(() => {
    const now = Date.now();
    const totalUsers = users.length;
    let engagedUsers = 0;
    let steamLinked = 0;
    let atRisk = 0;
    let newUsers = 0;
    let coldStart = 0;
    let stale = 0;
    let power = 0;

    for (const user of users) {
      const interactions = getInteractionCount(user);
      const createdAt = toTimestamp(user.createdAt);
      const updatedAt = toTimestamp(user.updatedAt);
      const isNew = createdAt ? now - createdAt <= dayMs : false;
      const isStale = updatedAt ? now - updatedAt >= dayMs * 30 : true;
      const health = getUserHealth(user, now);
      const riskScore = getUserRiskScore(user, now);

      if (interactions > 0) engagedUsers += 1;
      if (hasSteamProfile(user)) steamLinked += 1;
      if (interactions === 0) coldStart += 1;
      if (isStale) stale += 1;
      if (riskScore >= 60) atRisk += 1;
      if (isNew) newUsers += 1;
      if (health >= 80) power += 1;
    }

    const engagementRate = totalUsers ? Math.round((engagedUsers / totalUsers) * 100) : 0;
    const steamRate = totalUsers ? Math.round((steamLinked / totalUsers) * 100) : 0;
    const steamMissing = totalUsers - steamLinked;

    return {
      now,
      totalUsers,
      engagedUsers,
      steamLinked,
      steamMissing,
      atRisk,
      newUsers,
      coldStart,
      stale,
      power,
      engagementRate,
      steamRate,
    };
  }, [users]);

  const segments = [
    { id: 'all' as SegmentId, label: 'All users', count: aggregates.totalUsers },
    { id: 'new' as SegmentId, label: 'New in 24h', count: aggregates.newUsers },
    { id: 'cold' as SegmentId, label: 'Cold start', count: aggregates.coldStart },
    { id: 'stale' as SegmentId, label: 'Stale profiles', count: aggregates.stale },
    { id: 'steam-missing' as SegmentId, label: 'Steam missing', count: aggregates.steamMissing },
    { id: 'power' as SegmentId, label: 'Power users', count: aggregates.power },
  ];

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      if (!isSegmentMatch(user, activeSegment, aggregates.now)) {
        return false;
      }
      if (!term) return true;
      return (
        user.displayName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.id?.toLowerCase().includes(term)
      );
    });
  }, [query, users, activeSegment, aggregates.now]);

  const selectedSignals = useMemo(() => {
    if (!selectedUser) return null;
    const interactions = getInteractionCount(selectedUser);
    const hasSteam = hasSteamProfile(selectedUser);
    const updatedAt = toTimestamp(selectedUser.updatedAt);
    const createdAt = toTimestamp(selectedUser.createdAt);
    const lastSync = toTimestamp(selectedUser.steamLastSyncedAt);
    const isStale = updatedAt ? aggregates.now - updatedAt >= dayMs * 30 : true;
    const isNew = createdAt ? aggregates.now - createdAt <= dayMs : false;
    const health = getUserHealth(selectedUser, aggregates.now);
    const riskScore = getUserRiskScore(selectedUser, aggregates.now);
    const riskLabel = getRiskLabel(riskScore);

    return {
      interactions,
      hasSteam,
      updatedAt,
      createdAt,
      lastSync,
      isStale,
      isNew,
      health,
      riskScore,
      riskLabel,
    };
  }, [selectedUser, aggregates.now]);

  const insights = [
    {
      id: 'cold-start',
      title: 'Cold-start risk',
      detail: `${aggregates.coldStart} users have no interactions yet.`,
      count: aggregates.coldStart,
      segment: 'cold' as SegmentId,
      tone: 'warning' as const,
      icon: <WarningAmber fontSize="small" />,
    },
    {
      id: 'stale',
      title: 'Stale profiles',
      detail: `${aggregates.stale} profiles are older than 30 days.`,
      count: aggregates.stale,
      segment: 'stale' as SegmentId,
      tone: 'warning' as const,
      icon: <AccessTime fontSize="small" />,
    },
    {
      id: 'steam-gap',
      title: 'Steam gap',
      detail: `${aggregates.steamMissing} users have not linked Steam.`,
      count: aggregates.steamMissing,
      segment: 'steam-missing' as SegmentId,
      tone: 'info' as const,
      icon: <SportsEsports fontSize="small" />,
    },
    {
      id: 'power',
      title: 'Power users',
      detail: `${aggregates.power} profiles show strong engagement.`,
      count: aggregates.power,
      segment: 'power' as SegmentId,
      tone: 'success' as const,
      icon: <AutoAwesome fontSize="small" />,
    },
  ];

  const pulseCards = [
    {
      id: 'total',
      label: 'Total users',
      value: aggregates.totalUsers.toLocaleString(),
      helper: `${aggregates.newUsers} new in 24h`,
      icon: <Group fontSize="small" />,
      progress: undefined,
      tone: 'primary',
    },
    {
      id: 'engagement',
      label: 'Engagement coverage',
      value: `${aggregates.engagementRate}%`,
      helper: `${aggregates.engagedUsers} active profiles`,
      icon: <TrendingUp fontSize="small" />,
      progress: aggregates.engagementRate,
      tone: 'success',
    },
    {
      id: 'steam',
      label: 'Steam linked',
      value: `${aggregates.steamRate}%`,
      helper: `${aggregates.steamLinked} connected`,
      icon: <SportsEsports fontSize="small" />,
      progress: aggregates.steamRate,
      tone: 'secondary',
    },
    {
      id: 'risk',
      label: 'At-risk profiles',
      value: aggregates.atRisk.toLocaleString(),
      helper: 'Needs attention',
      icon: <WarningAmber fontSize="small" />,
      progress: undefined,
      tone: 'warning',
    },
  ];

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await mlAdminApi.getUsers();
      setUsers(data || []);
      setError(null);
      setLastRefreshAt(new Date());
      if (!selectedUserId && data?.length) {
        setSelectedUserId(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const liked = users.filter((user) => selectedUser.liked?.includes(user.id));
    const disliked = users.filter((user) => selectedUser.disliked?.includes(user.id));
    setLikedUsers(liked);
    setDislikedUsers(disliked);
  }, [selectedUser, users]);

  useEffect(() => {
    if (!selectedUser) return;
    setProfileForm({
      displayName: selectedUser.displayName ?? '',
      email: selectedUser.email ?? '',
      age: selectedUser.age ?? 18,
      gender: selectedUser.gender ?? 'Unknown',
      description: selectedUser.description ?? '',
      photoUrl: selectedUser.photoUrl ?? '',
      favoriteCategory: selectedUser.favoriteCategory ?? '',
      preferenceGender: selectedUser.preferenceGender ?? 'Any',
      preferenceAgeMin: selectedUser.preferenceAgeMin ?? 18,
      preferenceAgeMax: selectedUser.preferenceAgeMax ?? 35,
      favoriteGames: normalizeStringList(selectedUser.favoriteGames),
      otherGames: normalizeStringList(selectedUser.otherGames),
      languages: normalizeStringList(selectedUser.languages),
      preferenceCategories: normalizeStringList(selectedUser.preferenceCategories),
      preferenceLanguages: normalizeStringList(selectedUser.preferenceLanguages),
    });
    setProfileError(null);
  }, [selectedUser]);

  useEffect(() => {
    setProfileMessage(null);
    setProfileError(null);
    setProfileTab(0);
  }, [selectedUserId]);

  const handleCreateUser = async () => {
    try {
      setCreateLoading(true);
      setCreateError(null);
      const safeAge = Number.isFinite(createForm.age) ? createForm.age : undefined;
      const safeMin = Number.isFinite(createForm.preferenceAgeMin)
        ? createForm.preferenceAgeMin
        : undefined;
      const safeMax = Number.isFinite(createForm.preferenceAgeMax)
        ? createForm.preferenceAgeMax
        : undefined;
      const payload = {
        displayName: createForm.displayName.trim(),
        email: createForm.email.trim(),
        age: safeAge,
        gender: createForm.gender,
        preferenceGender: createForm.preferenceGender,
        preferenceAgeMin: safeMin,
        preferenceAgeMax: safeMax,
        languages: parseList(createForm.languages),
        favoriteGames: parseList(createForm.favoriteGames),
        preferenceCategories: parseList(createForm.preferenceCategories),
      };
      const created = await mlAdminApi.createUser(payload);
      setCreateMessage(`User created: ${created.displayName || created.email}`);
      setPresetNote(null);
      setCreateForm({
        displayName: '',
        email: '',
        age: 24,
        gender: 'Unknown',
        preferenceGender: 'Any',
        preferenceAgeMin: 18,
        preferenceAgeMax: 35,
        languages: '',
        favoriteGames: '',
        preferenceCategories: '',
      });
      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRandomUser = async () => {
    try {
      setCreateLoading(true);
      setCreateError(null);
      const created = await mlAdminApi.createRandomUser();
      setCreateMessage(`Random user created: ${created.displayName || created.email}`);
      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create random user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleBulkRandom = async () => {
    try {
      setCreateLoading(true);
      setCreateError(null);
      const result = await mlAdminApi.createRandomUsers(randomCount);
      setCreateMessage(result.message || `Created ${randomCount} users`);
      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create random users');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApplyInteractions = async () => {
    if (!selectedUser) return;
    try {
      setInteractionLoading(true);
      setInteractionError(null);
      const payload = {
        likedIds: likedUsers.map((user) => user.id),
        dislikedIds: dislikedUsers.map((user) => user.id),
        replace: replaceMode,
        removeConflicts: true,
      };
      const result = await mlAdminApi.updateUserInteractions(selectedUser.id, payload);
      setInteractionMessage(result.message || 'Interactions updated');
      await loadUsers();
    } catch (err: any) {
      setInteractionError(err?.message ?? 'Failed to update interactions');
    } finally {
      setInteractionLoading(false);
    }
  };

  const handleClearInteractions = async () => {
    if (!selectedUser) return;
    try {
      setInteractionLoading(true);
      setInteractionError(null);
      const result = await mlAdminApi.clearUserInteractions(selectedUser.id);
      setInteractionMessage(result.message || 'Interactions cleared');
      await loadUsers();
    } catch (err: any) {
      setInteractionError(err?.message ?? 'Failed to clear interactions');
    } finally {
      setInteractionLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!purgeTargetId.trim()) {
      setPurgeError('Enter a target user id to purge.');
      return;
    }
    try {
      setPurgeLoading(true);
      setPurgeError(null);
      const result = await mlAdminApi.purgeUserInteractions({
        targetUserId: purgeTargetId.trim(),
        removeFromLiked: true,
        removeFromDisliked: true,
      });
      setPurgeMessage(result.message || 'Purge completed');
      await loadUsers();
    } catch (err: any) {
      setPurgeError(err?.message ?? 'Failed to purge interactions');
    } finally {
      setPurgeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      const result = await mlAdminApi.deleteUser(selectedUser.id);
      setDeleteMessage(result.message || 'User deleted');
      setDeleteDialogOpen(false);
      setSelectedUserId(null);
      await loadUsers();
    } catch (err: any) {
      setDeleteError(err?.message ?? 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleContextAction = (message: string, tab?: number, segment?: SegmentId) => {
    setContextMessage(message);
    if (tab !== undefined) {
      setActionTab(tab);
    }
    if (segment) {
      setActiveSegment(segment);
    }
  };

  const profileDirty = useMemo(() => {
    if (!selectedUser) return false;
    return (
      profileForm.displayName.trim() !== (selectedUser.displayName ?? '') ||
      profileForm.email.trim() !== (selectedUser.email ?? '') ||
      profileForm.age !== (selectedUser.age ?? 18) ||
      profileForm.gender.trim() !== (selectedUser.gender ?? 'Unknown') ||
      profileForm.description.trim() !== (selectedUser.description ?? '') ||
      profileForm.photoUrl.trim() !== (selectedUser.photoUrl ?? '') ||
      profileForm.favoriteCategory.trim() !== (selectedUser.favoriteCategory ?? '') ||
      profileForm.preferenceGender.trim() !== (selectedUser.preferenceGender ?? 'Any') ||
      profileForm.preferenceAgeMin !== (selectedUser.preferenceAgeMin ?? 18) ||
      profileForm.preferenceAgeMax !== (selectedUser.preferenceAgeMax ?? 35) ||
      !areStringListsEqual(profileForm.favoriteGames, selectedUser.favoriteGames) ||
      !areStringListsEqual(profileForm.otherGames, selectedUser.otherGames) ||
      !areStringListsEqual(profileForm.languages, selectedUser.languages) ||
      !areStringListsEqual(profileForm.preferenceCategories, selectedUser.preferenceCategories) ||
      !areStringListsEqual(profileForm.preferenceLanguages, selectedUser.preferenceLanguages)
    );
  }, [profileForm, selectedUser]);

  const handleProfileSave = async () => {
    if (!selectedUser) return;
    try {
      setProfileLoading(true);
      setProfileError(null);
      const sharedGamesSet = new Set(sharedGames.map((game) => game.toLowerCase()));
      const sharedCategoriesSet = new Set(sharedCategories.map((category) => category.toLowerCase()));
      const favoriteGames = normalizeStringList(profileForm.favoriteGames).filter(
        (game) => !hasSharedGames || sharedGamesSet.has(game.toLowerCase())
      );
      const otherGames = normalizeStringList(profileForm.otherGames).filter(
        (game) => !hasSharedGames || sharedGamesSet.has(game.toLowerCase())
      );
      const preferenceCategories = normalizeStringList(profileForm.preferenceCategories).filter(
        (category) => !hasSharedCategories || sharedCategoriesSet.has(category.toLowerCase())
      );
      const favoriteCategory = profileForm.favoriteCategory.trim();
      const safeFavoriteCategory =
        !hasSharedCategories || !favoriteCategory
          ? favoriteCategory
          : sharedCategoriesSet.has(favoriteCategory.toLowerCase())
          ? favoriteCategory
          : '';
      const payload = {
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim(),
        age: Number.isFinite(profileForm.age) ? profileForm.age : undefined,
        gender: profileForm.gender.trim(),
        description: profileForm.description.trim(),
        photoUrl: profileForm.photoUrl.trim(),
        favoriteCategory: safeFavoriteCategory,
        preferenceGender: profileForm.preferenceGender.trim(),
        preferenceAgeMin: Number.isFinite(profileForm.preferenceAgeMin)
          ? profileForm.preferenceAgeMin
          : undefined,
        preferenceAgeMax: Number.isFinite(profileForm.preferenceAgeMax)
          ? profileForm.preferenceAgeMax
          : undefined,
        favoriteGames,
        otherGames,
        languages: normalizeStringList(profileForm.languages),
        preferenceCategories,
        preferenceLanguages: normalizeStringList(profileForm.preferenceLanguages),
      };
      await mlAdminApi.updateUser(selectedUser.id, payload);
      setProfileMessage('Profile updated');
      await loadUsers();
    } catch (err: any) {
      setProfileError(err?.message ?? 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileReset = () => {
    if (!selectedUser) return;
    setProfileForm({
      displayName: selectedUser.displayName ?? '',
      email: selectedUser.email ?? '',
      age: selectedUser.age ?? 18,
      gender: selectedUser.gender ?? 'Unknown',
      description: selectedUser.description ?? '',
      photoUrl: selectedUser.photoUrl ?? '',
      favoriteCategory: selectedUser.favoriteCategory ?? '',
      preferenceGender: selectedUser.preferenceGender ?? 'Any',
      preferenceAgeMin: selectedUser.preferenceAgeMin ?? 18,
      preferenceAgeMax: selectedUser.preferenceAgeMax ?? 35,
      favoriteGames: normalizeStringList(selectedUser.favoriteGames),
      otherGames: normalizeStringList(selectedUser.otherGames),
      languages: normalizeStringList(selectedUser.languages),
      preferenceCategories: normalizeStringList(selectedUser.preferenceCategories),
      preferenceLanguages: normalizeStringList(selectedUser.preferenceLanguages),
    });
  };

  const interactionTotal = likedUsers.length + dislikedUsers.length;
  const likeShare = interactionTotal ? Math.round((likedUsers.length / interactionTotal) * 100) : 0;
  const renderChips = (items: string[] | undefined, emptyLabel = 'n/a') => {
    const normalized = normalizeStringList(items);
    if (!normalized.length) {
      return (
        <Typography variant="caption" color="text.secondary">
          {emptyLabel}
        </Typography>
      );
    }
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {normalized.map((item) => (
          <Chip key={item} label={item} size="small" variant="outlined" />
        ))}
      </Stack>
    );
  };
  const hasSharedGames = sharedGames.length > 0;
  const hasSharedCategories = sharedCategories.length > 0;
  const languageOptions = useMemo(
    () => normalizeStringList([...(profileForm.languages ?? []), ...(profileForm.preferenceLanguages ?? [])]),
    [profileForm.languages, profileForm.preferenceLanguages]
  );

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title="User Operations Command Center"
            subheader="Live pulse, predictive signals, and operational clarity."
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                {lastRefreshAt && (
                  <Chip label={`Updated ${lastRefreshAt.toLocaleTimeString()}`} size="small" />
                )}
                <Button size="small" startIcon={<Refresh />} onClick={loadUsers}>
                  Refresh
                </Button>
              </Stack>
            }
          />
          <CardContent>
            <Grid container spacing={2} alignItems="stretch">
              <Grid size={{ xs: 12, lg: 8 }}>
                <Grid container spacing={2}>
                  {pulseCards.map((card, index) => (
                    <Grid key={card.id} size={{ xs: 12, sm: 6 }}>
                      <Grow in timeout={500 + index * 120}>
                        <Paper
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%',
                            background: (theme) =>
                              `linear-gradient(140deg, ${alpha(
                                theme.palette.primary.main,
                                0.08
                              )}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                          }}
                        >
                          <Stack spacing={1.5}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar
                                sx={{
                                  bgcolor: (theme) =>
                                    alpha(
                                      theme.palette[card.tone as 'primary' | 'secondary' | 'success' | 'warning']
                                        .main,
                                      0.14
                                    ),
                                  color: (theme) =>
                                    theme.palette[card.tone as 'primary' | 'secondary' | 'success' | 'warning'].main,
                                  width: 40,
                                  height: 40,
                                }}
                              >
                                {card.icon}
                              </Avatar>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  {card.label}
                                </Typography>
                                <Typography variant="h5">{card.value}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {card.helper}
                                </Typography>
                              </Box>
                            </Stack>
                            {card.progress !== undefined && (
                              <LinearProgress
                                variant="determinate"
                                value={card.progress}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            )}
                          </Stack>
                        </Paper>
                      </Grow>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    height: '100%',
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha('#1b4dff', 0.12), color: '#1b4dff' }}>
                        <AutoAwesome fontSize="small" />
                      </Avatar>
                      <Typography variant="subtitle2">Predictive insights</Typography>
                    </Stack>
                    {insights.filter((item) => item.count > 0).length === 0 && (
                      <Paper
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px dashed',
                          borderColor: 'divider',
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">All clear</Typography>
                          <Typography variant="caption" color="text.secondary">
                            No anomalies detected in the current user population.
                          </Typography>
                        </Stack>
                      </Paper>
                    )}
                    {insights
                      .filter((item) => item.count > 0)
                      .map((insight) => (
                        <Paper
                          key={insight.id}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            background: (theme) => {
                              const tone =
                                insight.tone === 'success'
                                  ? theme.palette.success.main
                                  : insight.tone === 'warning'
                                  ? theme.palette.warning.main
                                  : theme.palette.primary.main;
                              return `linear-gradient(140deg, ${alpha(
                                tone,
                                0.12
                              )}, ${alpha(tone, 0.04)})`;
                            },
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar
                                sx={{
                                  bgcolor: (theme) => alpha(theme.palette.common.white, 0.6),
                                  color: 'text.primary',
                                  width: 36,
                                  height: 36,
                                }}
                              >
                                {insight.icon}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2">{insight.title}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {insight.detail}
                                </Typography>
                              </Box>
                            </Stack>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setActiveSegment(insight.segment)}
                            >
                              Focus list
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader
            title="User Navigator"
            subheader="Segment, search, and select a profile"
            action={
              <Chip
                label={`${filteredUsers.length} shown`}
                size="small"
                color="primary"
                variant="outlined"
              />
            }
          />
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label="Search users"
                placeholder="Name, email, or id"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fullWidth
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {segments.map((segment) => (
                  <Chip
                    key={segment.id}
                    label={`${segment.label} (${segment.count})`}
                    color={activeSegment === segment.id ? 'primary' : 'default'}
                    variant={activeSegment === segment.id ? 'filled' : 'outlined'}
                    onClick={() => setActiveSegment(segment.id)}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
              {loading ? (
                <Stack spacing={1}>
                  <Skeleton variant="rounded" height={56} />
                  <Skeleton variant="rounded" height={56} />
                  <Skeleton variant="rounded" height={56} />
                </Stack>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : (
                <List sx={{ maxHeight: 520, overflowY: 'auto' }}>
                  {filteredUsers.map((user) => {
                    const health = getUserHealth(user, aggregates.now);
                    const riskScore = getUserRiskScore(user, aggregates.now);
                    const healthColor =
                      health >= 75 ? 'success' : health >= 50 ? 'warning' : 'error';
                    const riskLabel = getRiskLabel(riskScore);
                    return (
                      <ListItem key={user.id} disablePadding>
                        <ListItemButton
                          selected={user.id === selectedUserId}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <ListItemAvatar>
                            <Avatar src={user.photoUrl || user.steamAvatarUrl || undefined}>
                              {user.displayName?.[0] || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={user.displayName || user.email}
                            secondary={
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Typography variant="caption" color="text.secondary">
                                  {user.email || user.id}
                                </Typography>
                                <Chip label={`Health ${health}`} size="small" color={healthColor} />
                                <Chip
                                  label={`Risk ${riskLabel}`}
                                  size="small"
                                  color={
                                    riskLabel === 'High'
                                      ? 'error'
                                      : riskLabel === 'Medium'
                                      ? 'warning'
                                      : 'success'
                                  }
                                  variant="outlined"
                                />
                              </Stack>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={3}>
          <Card>
            <CardHeader title="User Intelligence" subheader="Context, health, and lifecycle signals." />
            <CardContent>
              {!selectedUser || !selectedSignals ? (
                <Alert severity="info">Select a user to see profile intelligence.</Alert>
              ) : (
                <Stack spacing={2}>
                  <Tabs
                    value={profileTab}
                    onChange={(_, value) => setProfileTab(value)}
                    sx={{ mb: 1 }}
                  >
                    <Tab label="Insights" />
                    <Tab label="Edit profile" />
                  </Tabs>

                  {profileTab === 0 && (
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          src={selectedUser.photoUrl || selectedUser.steamAvatarUrl || undefined}
                          sx={{ width: 72, height: 72 }}
                        >
                          {selectedUser.displayName?.[0] || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{selectedUser.displayName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedUser.email}
                          </Typography>
                          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                            <Chip label={`Age ${selectedUser.age ?? 'n/a'}`} size="small" />
                            <Chip label={selectedUser.gender || 'Unknown'} size="small" />
                            <Chip label={`${selectedSignals.interactions} interactions`} size="small" />
                            <Chip
                              label={`Risk ${selectedSignals.riskLabel}`}
                              size="small"
                              color={
                                selectedSignals.riskLabel === 'High'
                                  ? 'error'
                                  : selectedSignals.riskLabel === 'Medium'
                                  ? 'warning'
                                  : 'success'
                              }
                            />
                            {selectedSignals.isNew && <Chip label="New" size="small" color="info" />}
                          </Stack>
                        </Box>
                      </Stack>
                  <Paper
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) =>
                        `linear-gradient(130deg, ${alpha(
                          theme.palette.primary.main,
                          0.1
                        )}, ${alpha(theme.palette.secondary.main, 0.08)})`,
                    }}
                  >
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                            color: 'primary.main',
                          }}
                        >
                          <AutoAwesome fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">User health score</Typography>
                          <Typography variant="h4">{selectedSignals.health}</Typography>
                        </Box>
                      </Stack>
                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={selectedSignals.health}
                          sx={{ height: 10, borderRadius: 5 }}
                        />
                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                          {!selectedSignals.hasSteam && (
                            <Chip
                              label="Steam not linked"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                          {selectedSignals.isStale && (
                            <Chip
                              label="Profile stale"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                          {selectedSignals.interactions === 0 && (
                            <Chip
                              label="Cold start"
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Paper>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">Profile details</Typography>
                          <Typography variant="body2">User ID: {selectedUser.id}</Typography>
                          <Typography variant="body2">
                            Description: {selectedUser.description || 'n/a'}
                          </Typography>
                          <Typography variant="body2">
                            Favorite category: {selectedUser.favoriteCategory || 'n/a'}
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            Photo URL: {selectedUser.photoUrl || 'n/a'}
                          </Typography>
                          <Typography variant="body2">Languages</Typography>
                          {renderChips(selectedUser.languages, 'No languages')}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">Preferences</Typography>
                          <Typography variant="body2">
                            Preference gender: {selectedUser.preferenceGender || 'Any'}
                          </Typography>
                          <Typography variant="body2">
                            Preferred age range:{' '}
                            {selectedUser.preferenceAgeMin ?? 'n/a'} - {selectedUser.preferenceAgeMax ?? 'n/a'}
                          </Typography>
                          <Typography variant="body2">Preference categories</Typography>
                          {renderChips(selectedUser.preferenceCategories, 'No categories')}
                          <Typography variant="body2">Preference languages</Typography>
                          {renderChips(selectedUser.preferenceLanguages, 'No preference languages')}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">Games</Typography>
                          <Typography variant="body2">Favorite games</Typography>
                          {renderChips(selectedUser.favoriteGames, 'No favorites')}
                          <Typography variant="body2">Other games</Typography>
                          {renderChips(selectedUser.otherGames, 'No other games')}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">System data</Typography>
                          <Typography variant="body2">
                            Auth provider: {selectedUser.authProvider || 'n/a'}
                          </Typography>
                          <Typography variant="body2">
                            Provider ID: {selectedUser.providerId || 'n/a'}
                          </Typography>
                          <Typography variant="body2">
                            Created: {formatDateTime(selectedUser.createdAt)}
                          </Typography>
                          <Typography variant="body2">
                            Updated: {formatDateTime(selectedUser.updatedAt)}
                          </Typography>
                          <Typography variant="body2">
                            Likes: {selectedUser.liked?.length ?? 0} | Dislikes:{' '}
                            {selectedUser.disliked?.length ?? 0}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={2}>
                          <Typography variant="subtitle2">Steam profile</Typography>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Stack spacing={1}>
                                <Typography variant="body2">
                                  Steam ID: {selectedUser.steamId || 'n/a'}
                                </Typography>
                                <Typography variant="body2">
                                  Display name: {selectedUser.steamDisplayName || 'n/a'}
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                  Profile URL: {selectedUser.steamProfileUrl || 'n/a'}
                                </Typography>
                                <Typography variant="body2">
                                  Last sync: {formatDateTime(selectedUser.steamLastSyncedAt)}
                                </Typography>
                              </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Stack spacing={1}>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                  Steam avatar: {selectedUser.steamAvatarUrl || 'n/a'}
                                </Typography>
                                <Typography variant="body2">
                                  Shared games: {selectedUser.steamGames?.length ?? 0}
                                </Typography>
                                <Typography variant="body2">
                                  Shared categories: {selectedUser.steamCategories?.length ?? 0}
                                </Typography>
                              </Stack>
                            </Grid>
                          </Grid>
                          <Divider />
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                Steam games
                              </Typography>
                              <Box sx={{ maxHeight: 140, overflowY: 'auto' }}>
                                {renderChips(selectedUser.steamGames, 'No shared games')}
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                Steam categories
                              </Typography>
                              <Box sx={{ maxHeight: 140, overflowY: 'auto' }}>
                                {renderChips(selectedUser.steamCategories, 'No shared categories')}
                              </Box>
                            </Grid>
                          </Grid>
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Divider />

                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Journey timeline
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: alpha('#1b4dff', 0.12), color: '#1b4dff' }}>
                            <Timeline fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Profile created"
                          secondary={formatDateTime(selectedUser.createdAt)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: alpha('#ff8f00', 0.12), color: '#ff8f00' }}>
                            <TrendingUp fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Latest engagement update"
                          secondary={formatDateTime(selectedUser.updatedAt)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: alpha('#00a870', 0.12), color: '#00a870' }}>
                            <SportsEsports fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Steam sync"
                          secondary={formatDateTime(selectedUser.steamLastSyncedAt)}
                        />
                      </ListItem>
                    </List>
                  </Stack>

                  <Divider />

                  <Stack spacing={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Contextual actions
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                      {selectedSignals.interactions === 0 && (
                        <Button
                          variant="contained"
                          startIcon={<AutoFixHigh />}
                          onClick={() =>
                            handleContextAction('Seed interactions in Action Studio.', 1, 'cold')
                          }
                        >
                          Seed interactions
                        </Button>
                      )}
                      {!selectedSignals.hasSteam && (
                        <Button
                          variant="outlined"
                          startIcon={<SportsEsports />}
                          onClick={() =>
                            handleContextAction('Invite sent to connect Steam account.')
                          }
                        >
                          Invite Steam link
                        </Button>
                      )}
                      {selectedSignals.isStale && (
                        <Button
                          variant="outlined"
                          startIcon={<AccessTime />}
                          onClick={() => handleContextAction('Profile refresh request queued.')}
                        >
                          Request refresh
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        startIcon={<RestartAlt />}
                        onClick={handleClearInteractions}
                        disabled={!selectedUser}
                      >
                        Clear interactions
                      </Button>
                      <Button
                        variant="text"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={!selectedUser}
                      >
                        Delete user
                      </Button>
                    </Stack>
                    {contextMessage && <Alert severity="success">{contextMessage}</Alert>}
                    {interactionMessage && <Alert severity="success">{interactionMessage}</Alert>}
                    {interactionError && <Alert severity="error">{interactionError}</Alert>}
                  </Stack>
                    </Stack>
                  )}
                  {profileTab === 1 && (
                    <Stack spacing={2}>
                      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={2}>
                          <Typography variant="subtitle2">Avatar controls</Typography>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                          >
                            <Avatar
                              src={profileForm.photoUrl || selectedUser.steamAvatarUrl || undefined}
                              sx={{ width: 64, height: 64 }}
                            >
                              {selectedUser.displayName?.[0] || 'U'}
                            </Avatar>
                            <Stack spacing={1} sx={{ width: '100%' }}>
                              <TextField
                                label="Photo URL"
                                value={profileForm.photoUrl}
                                onChange={(event) =>
                                  setProfileForm({ ...profileForm, photoUrl: event.target.value })
                                }
                                fullWidth
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<SportsEsports />}
                                  disabled={!selectedUser.steamAvatarUrl}
                                  onClick={() =>
                                    setProfileForm({
                                      ...profileForm,
                                      photoUrl: selectedUser.steamAvatarUrl ?? '',
                                    })
                                  }
                                >
                                  Use Steam avatar
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="text"
                                  onClick={() => setProfileForm({ ...profileForm, photoUrl: '' })}
                                >
                                  Clear avatar
                                </Button>
                              </Stack>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Paper>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Display Name"
                            value={profileForm.displayName}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, displayName: event.target.value })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Email"
                            value={profileForm.email}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, email: event.target.value })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Age"
                            type="number"
                            value={profileForm.age}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, age: Number(event.target.value) })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Gender"
                            value={profileForm.gender}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, gender: event.target.value })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Preference Gender"
                            value={profileForm.preferenceGender}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, preferenceGender: event.target.value })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Preference Age Min"
                            type="number"
                            value={profileForm.preferenceAgeMin}
                            onChange={(event) =>
                              setProfileForm({
                                ...profileForm,
                                preferenceAgeMin: Number(event.target.value),
                              })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Preference Age Max"
                            type="number"
                            value={profileForm.preferenceAgeMax}
                            onChange={(event) =>
                              setProfileForm({
                                ...profileForm,
                                preferenceAgeMax: Number(event.target.value),
                              })
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            label="Description"
                            value={profileForm.description}
                            onChange={(event) =>
                              setProfileForm({ ...profileForm, description: event.target.value })
                            }
                            fullWidth
                            multiline
                            minRows={3}
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            options={sharedCategories}
                            value={profileForm.favoriteCategory || null}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, favoriteCategory: value ?? '' })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Favorite category"
                                helperText={
                                  hasSharedCategories
                                    ? 'Choose from Steam shared categories'
                                    : 'No Steam categories available'
                                }
                              />
                            )}
                            noOptionsText="No shared categories"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            multiple
                            options={sharedCategories}
                            value={profileForm.preferenceCategories}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, preferenceCategories: value })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Preference categories"
                                helperText={
                                  hasSharedCategories
                                    ? 'Choose from Steam shared categories'
                                    : 'No Steam categories available'
                                }
                              />
                            )}
                            noOptionsText="No shared categories"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            multiple
                            options={sharedGames}
                            value={profileForm.favoriteGames}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, favoriteGames: value })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Favorite games"
                                helperText={
                                  hasSharedGames
                                    ? 'Choose from Steam shared games'
                                    : 'No Steam games available'
                                }
                              />
                            )}
                            noOptionsText="No shared games"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            multiple
                            options={sharedGames}
                            value={profileForm.otherGames}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, otherGames: value })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Other games"
                                helperText={
                                  hasSharedGames
                                    ? 'Choose from Steam shared games'
                                    : 'No Steam games available'
                                }
                              />
                            )}
                            noOptionsText="No shared games"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={languageOptions}
                            value={profileForm.languages}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, languages: value })
                            }
                            renderInput={(params) => (
                              <TextField {...params} label="Languages" helperText="Press enter to add" />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={languageOptions}
                            value={profileForm.preferenceLanguages}
                            onChange={(_, value) =>
                              setProfileForm({ ...profileForm, preferenceLanguages: value })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Preference languages"
                                helperText="Press enter to add"
                              />
                            )}
                          />
                        </Grid>
                      </Grid>

                      <Divider />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button
                          variant="contained"
                          startIcon={<AutoFixHigh />}
                          onClick={handleProfileSave}
                          disabled={!profileDirty || profileLoading}
                        >
                          {profileLoading ? 'Saving...' : 'Save changes'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={handleProfileReset}
                          disabled={!profileDirty || profileLoading}
                        >
                          Reset
                        </Button>
                      </Stack>

                      {profileMessage && <Alert severity="success">{profileMessage}</Alert>}
                      {profileError && <Alert severity="error">{profileError}</Alert>}
                    </Stack>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Action Studio" subheader="Create, tune, and safeguard user data." />
            <CardContent>
              <Tabs value={actionTab} onChange={(_, value) => setActionTab(value)} sx={{ mb: 2 }}>
                <Tab label="Create" />
                <Tab label="Interactions" />
                <Tab label="Cleanup" />
                <Tab label="Messaging" />
              </Tabs>

              {actionTab === 0 && (
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    {personaPresets.map((preset) => (
                      <Grid key={preset.id} size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">{preset.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {preset.description}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setCreateForm((prev) => ({ ...prev, ...preset.values }));
                                setPresetNote(`Preset applied: ${preset.label}`);
                              }}
                            >
                              Apply preset
                            </Button>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {presetNote && <Alert severity="info">{presetNote}</Alert>}

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Display Name"
                        value={createForm.displayName}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, displayName: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Email"
                        value={createForm.email}
                        onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Age"
                        type="number"
                        value={createForm.age}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, age: Number(event.target.value) })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Gender"
                        value={createForm.gender}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, gender: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Preference Gender"
                        value={createForm.preferenceGender}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, preferenceGender: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Preference Age Min"
                        type="number"
                        value={createForm.preferenceAgeMin}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, preferenceAgeMin: Number(event.target.value) })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Preference Age Max"
                        type="number"
                        value={createForm.preferenceAgeMax}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, preferenceAgeMax: Number(event.target.value) })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Languages (comma-separated)"
                        value={createForm.languages}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, languages: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Favorite Games (comma-separated)"
                        value={createForm.favoriteGames}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, favoriteGames: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="Preference Categories (comma-separated)"
                        value={createForm.preferenceCategories}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, preferenceCategories: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleCreateUser}
                      disabled={createLoading || !createForm.displayName.trim() || !createForm.email.trim()}
                    >
                      Create User
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Person />}
                      onClick={handleRandomUser}
                      disabled={createLoading}
                    >
                      Random User
                    </Button>
                    <TextField
                      label="Bulk random count"
                      type="number"
                      value={randomCount}
                      onChange={(event) => setRandomCount(Number(event.target.value))}
                      sx={{ maxWidth: 160 }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<GroupAdd />}
                      onClick={handleBulkRandom}
                      disabled={createLoading}
                    >
                      Bulk Random
                    </Button>
                  </Stack>
                  {createMessage && <Alert severity="success">{createMessage}</Alert>}
                  {createError && <Alert severity="error">{createError}</Alert>}
                </Stack>
              )}

              {actionTab === 1 && (
                <Stack spacing={2}>
                  {!selectedUser ? (
                    <Alert severity="info">Select a user to manage interactions.</Alert>
                  ) : (
                    <>
                      <Paper
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          background: (theme) =>
                            `linear-gradient(120deg, ${alpha(
                              theme.palette.primary.main,
                              0.06
                            )}, ${alpha(theme.palette.secondary.main, 0.06)})`,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AutoAwesome fontSize="small" color="primary" />
                            <Typography variant="subtitle2">Affinity balance</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            Likes: {likedUsers.length} | Dislikes: {dislikedUsers.length}
                          </Typography>
                          <Tooltip title="Higher means more positive interactions">
                            <LinearProgress
                              variant="determinate"
                              value={likeShare}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Tooltip>
                        </Stack>
                      </Paper>

                      <Autocomplete
                        multiple
                        options={users.filter((user) => user.id !== selectedUser.id)}
                        value={likedUsers}
                        onChange={(_, value) => setLikedUsers(value)}
                        getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                        renderInput={(params) => (
                          <TextField {...params} label="Liked users" placeholder="Search users" />
                        )}
                      />
                      <Autocomplete
                        multiple
                        options={users.filter((user) => user.id !== selectedUser.id)}
                        value={dislikedUsers}
                        onChange={(_, value) => setDislikedUsers(value)}
                        getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                        renderInput={(params) => (
                          <TextField {...params} label="Disliked users" placeholder="Search users" />
                        )}
                      />
                      <ToggleButtonGroup
                        value={replaceMode ? 'replace' : 'merge'}
                        exclusive
                        onChange={(_, value) => {
                          if (value) setReplaceMode(value === 'replace');
                        }}
                        size="small"
                      >
                        <ToggleButton value="replace">Replace mode</ToggleButton>
                        <ToggleButton value="merge">Merge mode</ToggleButton>
                      </ToggleButtonGroup>
                      <Stack direction="row" spacing={2}>
                        <Button
                          variant="contained"
                          onClick={handleApplyInteractions}
                          disabled={interactionLoading}
                        >
                          Apply interactions
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<RemoveCircle />}
                          onClick={handleClearInteractions}
                          disabled={interactionLoading}
                        >
                          Clear interactions
                        </Button>
                      </Stack>
                      {interactionMessage && <Alert severity="success">{interactionMessage}</Alert>}
                      {interactionError && <Alert severity="error">{interactionError}</Alert>}
                    </>
                  )}
                </Stack>
              )}

              {actionTab === 2 && (
                <Stack spacing={2}>
                  <Alert severity="warning">
                    Cleanup actions permanently change stored interactions. Proceed carefully.
                  </Alert>
                  <Paper
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) =>
                        `linear-gradient(140deg, ${alpha(
                          theme.palette.warning.main,
                          0.12
                        )}, ${alpha(theme.palette.warning.main, 0.04)})`,
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Trust and safety guardrails</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Use purge and delete actions when you are confident the data is no longer needed.
                      </Typography>
                    </Stack>
                  </Paper>
                  <TextField
                    label="Target user id to purge from all likes/dislikes"
                    value={purgeTargetId}
                    onChange={(event) => setPurgeTargetId(event.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    startIcon={<RemoveCircle />}
                    onClick={handlePurge}
                    disabled={purgeLoading}
                  >
                    Purge interactions
                  </Button>
                  {purgeMessage && <Alert severity="success">{purgeMessage}</Alert>}
                  {purgeError && <Alert severity="error">{purgeError}</Alert>}
                  <Divider />
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Delete />}
                    disabled={!selectedUser}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete selected user
                  </Button>
                  {deleteMessage && <Alert severity="success">{deleteMessage}</Alert>}
                  {deleteError && <Alert severity="error">{deleteError}</Alert>}
                </Stack>
              )}

              {actionTab === 3 && (
                <UserMessagingStudio users={users} defaultUserId={selectedUserId} />
              )}
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              This will remove the user and their interactions. Type DELETE to confirm.
            </Typography>
            <TextField
              label="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteConfirm.trim().toLowerCase() !== 'delete' || deleteLoading}
          >
            Delete user
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};
