import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Delete, MarkChatRead, Refresh, Send, SwapHoriz } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { AdminConversation, AdminConversationSummary, AdminMessage, mlAdminApi } from '../api/mlAdminApi';

type UserOption = {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
};

type UserMessagingStudioProps = {
  users: UserOption[];
  defaultUserId?: string | null;
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (value?: string) => {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'n/a' : parsed.toLocaleString();
};

export const UserMessagingStudio: React.FC<UserMessagingStudioProps> = ({
  users,
  defaultUserId,
}) => {
  const [primaryUser, setPrimaryUser] = useState<UserOption | null>(null);
  const [targetUser, setTargetUser] = useState<UserOption | null>(null);
  const [senderId, setSenderId] = useState<string>('');
  const [markReadUserId, setMarkReadUserId] = useState<string>('');
  const [messageType, setMessageType] = useState<'Text' | 'Image'>('Text');
  const [messageText, setMessageText] = useState('');
  const [messageUrl, setMessageUrl] = useState('');
  const [conversationList, setConversationList] = useState<AdminConversationSummary[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageBusy, setMessageBusy] = useState(false);

  const userById = useMemo(() => {
    const map = new Map<string, UserOption>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const participantOptions = useMemo(() => {
    if (!activeConversation?.participants) return [];
    return activeConversation.participants
      .map((participant) => userById.get(participant.userId))
      .filter(Boolean) as UserOption[];
  }, [activeConversation, userById]);

  useEffect(() => {
    if (!defaultUserId || primaryUser) return;
    const nextUser = users.find((user) => user.id === defaultUserId) ?? null;
    if (nextUser) {
      setPrimaryUser(nextUser);
    }
  }, [defaultUserId, primaryUser, users]);

  useEffect(() => {
    if (!primaryUser) {
      setSenderId('');
      setMarkReadUserId('');
      return;
    }
    setSenderId(primaryUser.id);
    setMarkReadUserId(primaryUser.id);
  }, [primaryUser]);

  const refreshConversationList = async () => {
    if (!primaryUser) return;
    try {
      setConversationLoading(true);
      const data = await mlAdminApi.getAdminConversations(primaryUser.id);
      setConversationList(data ?? []);
      setConversationError(null);
    } catch (err: any) {
      setConversationError(err?.message ?? 'Failed to load conversations');
    } finally {
      setConversationLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setMessageLoading(true);
      const [conversation, messageList] = await Promise.all([
        mlAdminApi.getAdminConversation(conversationId),
        mlAdminApi.getAdminMessages(conversationId, 120),
      ]);
      setActiveConversation(conversation);
      setMessages(messageList ?? []);
      setActiveConversationId(conversationId);
      setMessageError(null);
    } catch (err: any) {
      setMessageError(err?.message ?? 'Failed to load messages');
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    if (!primaryUser) {
      setConversationList([]);
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    refreshConversationList();
  }, [primaryUser]);

  const handleOpenConversation = async () => {
    if (!primaryUser || !targetUser) return;
    if (primaryUser.id === targetUser.id) {
      setConversationError('Select two different users.');
      return;
    }

    try {
      setConversationError(null);
      setMessageError(null);
      setMessageLoading(true);
      const result = await mlAdminApi.createAdminConversation(primaryUser.id, targetUser.id);
      await loadConversation(result.conversationId);
      await refreshConversationList();
    } catch (err: any) {
      setConversationError(err?.message ?? 'Failed to open conversation');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleSelectConversation = async (summary: AdminConversationSummary) => {
    setActiveConversationId(summary.id);
    const nextTarget = users.find((user) => user.id === summary.otherUserId) ?? null;
    setTargetUser(nextTarget);
    await loadConversation(summary.id);
  };

  const handleSendMessage = async () => {
    if (!activeConversationId || !senderId) return;
    if (messageType === 'Text' && !messageText.trim()) return;
    if (messageType === 'Image' && !messageUrl.trim()) return;

    try {
      setMessageBusy(true);
      const payload = {
        senderId,
        message: messageType === 'Text' ? messageText.trim() : messageText.trim(),
        messageType,
        url: messageType === 'Image' ? messageUrl.trim() : undefined,
      };
      const created = await mlAdminApi.sendAdminMessage(activeConversationId, payload);
      setMessages((prev) => [...prev, created]);
      setMessageText('');
      setMessageUrl('');
      await refreshConversationList();
    } catch (err: any) {
      setMessageError(err?.message ?? 'Failed to send message');
    } finally {
      setMessageBusy(false);
    }
  };

  const handleMarkRead = async () => {
    if (!activeConversationId || !markReadUserId) return;
    try {
      setMessageBusy(true);
      await mlAdminApi.markAdminMessagesRead(activeConversationId, { userId: markReadUserId });
      await loadConversation(activeConversationId);
      await refreshConversationList();
    } catch (err: any) {
      setMessageError(err?.message ?? 'Failed to mark messages as read');
    } finally {
      setMessageBusy(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversationId) return;
    const ok = window.confirm('Delete this message? This cannot be undone.');
    if (!ok) return;
    try {
      setMessageBusy(true);
      await mlAdminApi.deleteAdminMessage(activeConversationId, messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      await loadConversation(activeConversationId);
      await refreshConversationList();
    } catch (err: any) {
      setMessageError(err?.message ?? 'Failed to delete message');
    } finally {
      setMessageBusy(false);
    }
  };

  const conversationHeader = activeConversation?.participants?.map((participant) => (
    <Stack key={participant.userId} direction="row" spacing={1} alignItems="center">
      <Avatar src={participant.photoUrl || undefined} sx={{ width: 28, height: 28 }}>
        {participant.displayName?.[0] ?? 'U'}
      </Avatar>
      <Stack spacing={0}>
        <Typography variant="body2">{participant.displayName}</Typography>
        <Typography variant="caption" color="text.secondary">
          {participant.isOnline ? 'Online' : 'Offline'}
        </Typography>
      </Stack>
    </Stack>
  ));

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Autocomplete
            value={primaryUser}
            onChange={(_, value) => setPrimaryUser(value)}
            options={users}
            getOptionLabel={(option) => `${option.displayName} (${option.email})`}
            renderInput={(params) => <TextField {...params} label="User A (primary)" />}
            sx={{ flex: 1 }}
          />
          <IconButton
            onClick={() => {
              if (!primaryUser || !targetUser) return;
              setPrimaryUser(targetUser);
              setTargetUser(primaryUser);
            }}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
          >
            <SwapHoriz />
          </IconButton>
          <Autocomplete
            value={targetUser}
            onChange={(_, value) => setTargetUser(value)}
            options={users.filter((user) => user.id !== primaryUser?.id)}
            getOptionLabel={(option) => `${option.displayName} (${option.email})`}
            renderInput={(params) => <TextField {...params} label="User B (partner)" />}
            sx={{ flex: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleOpenConversation} disabled={!primaryUser || !targetUser}>
              Open chat
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={refreshConversationList}
              disabled={!primaryUser || conversationLoading}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
        {conversationError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {conversationError}
          </Alert>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '320px 1fr' } }}>
        <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: alpha('#0f172a', 0.03) }}>
            <Typography variant="subtitle2">Conversations</Typography>
            <Typography variant="caption" color="text.secondary">
              {primaryUser ? `Showing ${conversationList.length} conversations` : 'Pick a primary user'}
            </Typography>
          </Box>
          <Divider />
          {conversationLoading ? (
            <Stack spacing={1} sx={{ p: 2 }}>
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} variant="rounded" height={64} />
              ))}
            </Stack>
          ) : (
            <List sx={{ maxHeight: 420, overflowY: 'auto' }}>
              {conversationList.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No conversations yet"
                    secondary="Create a conversation to start messaging."
                  />
                </ListItem>
              )}
              {conversationList.map((item) => (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton
                    selected={item.id === activeConversationId}
                    onClick={() => handleSelectConversation(item)}
                    sx={{ py: 1.25 }}
                  >
                    <ListItemAvatar>
                      <Avatar src={item.otherUserPhotoUrl || undefined}>
                        {item.otherUserName?.[0] ?? 'U'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.otherUserName}
                      secondary={
                        item.lastMessage
                          ? `${item.lastMessage.slice(0, 42)}${item.lastMessage.length > 42 ? '...' : ''}`
                          : 'No messages yet'
                      }
                    />
                    <Stack spacing={0.5} alignItems="flex-end">
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(item.lastMessageTime)}
                      </Typography>
                      {item.unreadCount > 0 && (
                        <Chip label={item.unreadCount} size="small" color="primary" />
                      )}
                    </Stack>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Paper
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 520,
          }}
        >
          <Box sx={{ p: 2, bgcolor: alpha('#0f172a', 0.03) }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Conversation feed</Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeConversationId ? `ID: ${activeConversationId}` : 'Select a conversation'}
                </Typography>
              </Stack>
              <Box sx={{ ml: { md: 'auto' } }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {conversationHeader}
                  {activeConversation?.lastMessageTimestamp && (
                    <Chip
                      label={`Updated ${formatDateTime(activeConversation.lastMessageTimestamp)}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>
          <Divider />
          <Box
            sx={{
              flex: 1,
              p: 2,
              bgcolor: alpha('#0f172a', 0.02),
              overflowY: 'auto',
            }}
          >
            {messageLoading ? (
              <Stack spacing={2}>
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} variant="rounded" height={72} />
                ))}
              </Stack>
            ) : !activeConversationId ? (
              <Alert severity="info">Pick two users or select a conversation to view messages.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {messages.length === 0 && (
                  <Alert severity="info">No messages yet. Send the first message below.</Alert>
                )}
                {messages.map((msg) => {
                  const isPrimary = msg.senderId === primaryUser?.id;
                  const sender = userById.get(msg.senderId);
                  return (
                    <Stack
                      key={msg.id}
                      direction="row"
                      spacing={1}
                      justifyContent={isPrimary ? 'flex-end' : 'flex-start'}
                    >
                      <Box
                        sx={{
                          maxWidth: '74%',
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isPrimary
                            ? alpha('#1b4dff', 0.9)
                            : 'common.white',
                          color: isPrimary ? 'common.white' : 'text.primary',
                          border: isPrimary ? '1px solid transparent' : '1px solid',
                          borderColor: isPrimary ? 'transparent' : 'divider',
                          boxShadow: isPrimary ? '0 12px 22px rgba(27,77,255,0.25)' : 'none',
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            {sender?.displayName ?? msg.senderId}
                          </Typography>
                          {msg.messageType === 'Image' && msg.url && (
                            <Box
                              component="img"
                              src={msg.url}
                              alt="Message attachment"
                              sx={{
                                width: '100%',
                                maxHeight: 220,
                                objectFit: 'cover',
                                borderRadius: 1.5,
                                border: '1px solid',
                                borderColor: isPrimary ? alpha('#ffffff', 0.3) : 'divider',
                              }}
                            />
                          )}
                          {msg.message && (
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                              {msg.message}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {formatTime(msg.timestamp)}
                            </Typography>
                            <Chip
                              label={msg.status}
                              size="small"
                              color={msg.status === 'Read' ? 'success' : 'default'}
                              variant={msg.status === 'Read' ? 'filled' : 'outlined'}
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                bgcolor: msg.status === 'Read' && isPrimary ? alpha('#ffffff', 0.24) : undefined,
                                color: isPrimary && msg.status === 'Read' ? 'common.white' : undefined,
                                borderColor: isPrimary && msg.status !== 'Read' ? alpha('#ffffff', 0.4) : undefined,
                              }}
                            />
                          </Stack>
                        </Stack>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMessage(msg.id)}
                        sx={{ alignSelf: 'flex-end' }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>
            )}
            {messageError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {messageError}
              </Alert>
            )}
          </Box>
          <Divider />
          <Stack spacing={2} sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Autocomplete
                value={users.find((user) => user.id === senderId) ?? null}
                onChange={(_, value) => setSenderId(value?.id ?? '')}
                options={participantOptions}
                getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                renderInput={(params) => <TextField {...params} label="Send as" />}
                sx={{ minWidth: 240 }}
                disabled={!activeConversationId}
              />
              <ToggleButtonGroup
                value={messageType}
                exclusive
                onChange={(_, value) => {
                  if (value === 'Text' || value === 'Image') {
                    setMessageType(value);
                  }
                }}
                size="small"
                disabled={!activeConversationId}
              >
                <ToggleButton value="Text">Text</ToggleButton>
                <ToggleButton value="Image">Image</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Autocomplete
                  value={users.find((user) => user.id === markReadUserId) ?? null}
                  onChange={(_, value) => setMarkReadUserId(value?.id ?? '')}
                  options={participantOptions}
                  getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                  renderInput={(params) => <TextField {...params} label="Mark read for" />}
                  sx={{ minWidth: 220 }}
                  disabled={!activeConversationId}
                />
                <Button
                  variant="outlined"
                  startIcon={<MarkChatRead />}
                  onClick={handleMarkRead}
                  disabled={!activeConversationId || !markReadUserId || messageBusy}
                >
                  Mark read
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                label={messageType === 'Image' ? 'Caption (optional)' : 'Message'}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={!activeConversationId}
              />
              {messageType === 'Image' && (
                <TextField
                  label="Image URL"
                  value={messageUrl}
                  onChange={(event) => setMessageUrl(event.target.value)}
                  sx={{ minWidth: 240 }}
                  disabled={!activeConversationId}
                />
              )}
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={handleSendMessage}
                disabled={
                  !activeConversationId ||
                  !senderId ||
                  messageBusy ||
                  (messageType === 'Text' ? !messageText.trim() : !messageUrl.trim())
                }
                sx={{ alignSelf: { xs: 'stretch', md: 'center' } }}
              >
                Send
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
};
