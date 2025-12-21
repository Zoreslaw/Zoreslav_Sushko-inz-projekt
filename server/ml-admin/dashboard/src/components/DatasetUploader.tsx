import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { CloudUpload, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { mlAdminApi } from '../api/mlAdminApi';

export const DatasetUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
        setSuccess(null);
        setStats(null);
      } else {
        setError('Please select a CSV file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress (since we can't track actual upload progress easily)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await mlAdminApi.uploadDataset(formData);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setSuccess(
        `Successfully imported ${result.users_imported || 0} users and ` +
        `${result.interactions_imported || 0} interactions!`
      );
      setStats(result);
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('csv-upload-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload dataset');
      setProgress(0);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CloudUpload />
          <Typography variant="h6">Dataset Upload</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          Upload a CSV file with user data and interactions. The file should contain columns:
          id, display_name, email, age, gender, favorite_games, languages, liked, disliked, etc.
        </Typography>

        <Box mb={2}>
          <input
            id="csv-upload-input"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <label htmlFor="csv-upload-input">
            <Button
              variant="outlined"
              component="span"
              disabled={uploading}
              startIcon={<CloudUpload />}
              sx={{ mr: 2 }}
            >
              Select CSV File
            </Button>
          </label>
          {file && (
            <Typography variant="body2" sx={{ mt: 1, display: 'inline-block' }}>
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
            </Typography>
          )}
        </Box>

        {file && (
          <Box mb={2}>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={18} /> : <CloudUpload />}
            >
              {uploading ? 'Uploading...' : 'Upload Dataset'}
            </Button>
          </Box>
        )}

        {uploading && (
          <Box mb={2}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Uploading... {progress}%
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }} icon={<ErrorIcon />}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }} icon={<CheckCircle />}>
            {success}
          </Alert>
        )}

        {stats && (
          <Box mt={2} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Import Statistics:
            </Typography>
            <Typography variant="body2">
              - Users imported: {stats.users_imported || 0}
            </Typography>
            <Typography variant="body2">
              - Interactions imported: {stats.interactions_imported || 0}
            </Typography>
            <Typography variant="body2">
              - Likes: {stats.likes_count || 0}
            </Typography>
            <Typography variant="body2">
              - Dislikes: {stats.dislikes_count || 0}
            </Typography>
            {stats.errors && stats.errors.length > 0 && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                - Errors: {stats.errors.length}
              </Typography>
            )}
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Tip: Use the AI Dataset Generation Prompt to create a realistic dataset with 1000+ users.
        </Typography>
      </CardContent>
    </Card>
  );
};

