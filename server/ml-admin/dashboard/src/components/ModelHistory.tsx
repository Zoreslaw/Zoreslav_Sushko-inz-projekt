import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Pagination,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  CheckCircle,
  Visibility,
  PlayArrow,
  SwapHoriz,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { mlAdminApi, ModelHistoryItem } from '../api/mlAdminApi';

const ITEMS_PER_PAGE = 20;

export const ModelHistory: React.FC = () => {
  const [models, setModels] = useState<ModelHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedModel, setSelectedModel] = useState<ModelHistoryItem | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logContent, setLogContent] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [modelToActivate, setModelToActivate] = useState<ModelHistoryItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchModels = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await mlAdminApi.getModelsHistory(pageNum, ITEMS_PER_PAGE);
      setModels(response?.models || []);
      setTotal(response?.total || 0);
      setTotalPages(response?.total_pages || 1);
      setPage(response?.page || pageNum);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load model history');
      setModels([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels(1);
  }, [fetchModels]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    fetchModels(value);
  };

  const handleViewLogs = async (model: ModelHistoryItem) => {
    try {
      setLoadingLogs(true);
      setSelectedModel(model);
      setLogDialogOpen(true);
      const response = await mlAdminApi.getModelLogs(model.version);
      setLogContent(response.log_content || 'No log content available for this model.');
    } catch (e: any) {
      setLogContent(`Error loading logs: ${e.message ?? 'Unknown error'}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleActivateClick = (model: ModelHistoryItem) => {
    setModelToActivate(model);
    setActivateDialogOpen(true);
  };

  const handleActivateConfirm = async () => {
    if (!modelToActivate) return;
    
    try {
      setActivating(modelToActivate.version);
      setActivateDialogOpen(false);
      await mlAdminApi.activateModel(modelToActivate.version);
      // Refresh the list to update is_current flags
      await fetchModels(page);
      setError(null);
      setSuccessMessage(`Model ${modelToActivate.version} is now active. The ML service will use this model for recommendations.`);
      setModelToActivate(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to activate model');
    } finally {
      setActivating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'stopped':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading && (!models || models.length === 0)) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Model History</Typography>
            <Typography variant="body2" color="text.secondary">
              Total: {total} models
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!models || models.length === 0 ? (
            <Alert severity="info">No models found. Start training to create models.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Version</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Users</TableCell>
                      <TableCell>Interactions</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {models.map((model) => (
                      <TableRow
                        key={model.version}
                        sx={{
                          bgcolor: model.is_current ? 'action.selected' : 'transparent',
                        }}
                      >
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {model.is_current && (
                              <Chip
                                icon={<CheckCircle />}
                                label="Current"
                                color="success"
                                size="small"
                              />
                            )}
                            <Typography variant="body2" fontFamily="monospace">
                              {model.version}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(model.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{model.size_mb.toFixed(2)} MB</TableCell>
                        <TableCell>{model.num_users ?? '-'}</TableCell>
                        <TableCell>{model.num_interactions ?? '-'}</TableCell>
                        <TableCell>
                          {model.duration_seconds
                            ? `${(model.duration_seconds / 60).toFixed(1)} min`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={model.status}
                            color={getStatusColor(model.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box display="flex" gap={1} justifyContent="flex-end" alignItems="center">
                            <Tooltip title="View Training Logs">
                              <IconButton
                                size="small"
                                onClick={() => handleViewLogs(model)}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {model.is_current ? (
                              <Chip
                                label="Active"
                                color="success"
                                size="small"
                                icon={<CheckCircle />}
                              />
                            ) : (
                              <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                startIcon={activating === model.version ? <CircularProgress size={16} /> : <SwapHoriz />}
                                onClick={() => handleActivateClick(model)}
                                disabled={activating === model.version || !!activating}
                              >
                                {activating === model.version ? 'Activating...' : 'Switch to This Model'}
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={logDialogOpen}
        onClose={() => setLogDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Training Logs: {selectedModel?.version}
        </DialogTitle>
        <DialogContent>
          {loadingLogs ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '60vh',
                overflow: 'auto',
                bgcolor: 'grey.100',
                p: 2,
                borderRadius: 1,
              }}
            >
              {logContent || 'No log content available.'}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={activateDialogOpen}
        onClose={() => setActivateDialogOpen(false)}
      >
        <DialogTitle>Switch to Model {modelToActivate?.version}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to switch to this model? The ML service will immediately start using this model for all recommendations.
          </Typography>
          {modelToActivate && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Version:</strong> {modelToActivate.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Created:</strong> {new Date(modelToActivate.created_at).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Size:</strong> {modelToActivate.size_mb.toFixed(2)} MB
              </Typography>
              {modelToActivate.num_users && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Users:</strong> {modelToActivate.num_users}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleActivateConfirm}
            disabled={!!activating}
          >
            {activating ? 'Activating...' : 'Switch Model'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </>
  );
};



