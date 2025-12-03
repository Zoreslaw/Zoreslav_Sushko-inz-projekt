import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, UserProfile } from '@/services/api';

export interface ProfileData {
  avatarUrl: string;
  userName: string;
  favoriteCategory: string;
  languages: string[];
  age: number | null;
  gender: string;
  description: string;
  preferredCategories: string[];
  preferredLanguages: string[];
  preferredAgeRange: Map<string, number>;
  preferredGender: string;
  favoriteGames: string[];
  otherGames: string[];
}

export interface ProfileUpdate {
  photoUrl?: string;
  displayName?: string;
  favoriteCategory?: string;
  languages?: string[];
  age?: string;
  gender?: string;
  description?: string;
  preferenceCategories?: string[];
  preferenceLanguages?: string[];
  preferenceAgeRange?: Map<string, number>;
  preferenceGender?: string;
  favoriteGames?: string[];
  otherGames?: string[];
}

interface UseProfileResult {
  profile: ProfileData;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    avatarUrl: '',
    userName: '',
    favoriteCategory: '',
    languages: [],
    age: null,
    gender: '',
    description: '',
    preferredCategories: [],
    preferredLanguages: [],
    preferredAgeRange: new Map(),
    preferredGender: '',
    favoriteGames: [],
    otherGames: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await api.getProfile();
      
      // Convert API response to ProfileData format
      const preferredAgeRange = new Map<string, number>();
      if (data.preferenceAgeMin !== undefined) {
        preferredAgeRange.set('min', data.preferenceAgeMin);
      }
      if (data.preferenceAgeMax !== undefined) {
        preferredAgeRange.set('max', data.preferenceAgeMax);
      }

      setProfile({
        avatarUrl: data.photoUrl || '',
        userName: data.displayName || 'NoName',
        favoriteCategory: data.favoriteCategory || '',
        languages: data.languages || [],
        age: data.age || null,
        gender: data.gender || '',
        description: data.description || '',
        preferredCategories: data.preferenceCategories || [],
        preferredLanguages: data.preferenceLanguages || [],
        preferredAgeRange,
        preferredGender: data.preferenceGender || '',
        favoriteGames: data.favoriteGames || [],
        otherGames: data.otherGames || [],
      });
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Convert ProfileUpdate to API format
      const apiUpdates: Partial<UserProfile> = {};

      if (updates.photoUrl !== undefined) {
        apiUpdates.photoUrl = updates.photoUrl;
      }
      if (updates.displayName !== undefined) {
        apiUpdates.displayName = updates.displayName;
      }
      if (updates.favoriteCategory !== undefined) {
        apiUpdates.favoriteCategory = updates.favoriteCategory;
      }
      if (updates.languages !== undefined) {
        apiUpdates.languages = updates.languages;
      }
      if (updates.age !== undefined) {
        apiUpdates.age = updates.age === '' ? 0 : Number(updates.age);
      }
      if (updates.gender !== undefined) {
        apiUpdates.gender = updates.gender;
      }
      if (updates.description !== undefined) {
        apiUpdates.description = updates.description;
      }
      if (updates.preferenceCategories !== undefined) {
        apiUpdates.preferenceCategories = updates.preferenceCategories;
      }
      if (updates.preferenceLanguages !== undefined) {
        apiUpdates.preferenceLanguages = updates.preferenceLanguages;
      }
      if (updates.preferenceAgeRange instanceof Map) {
        apiUpdates.preferenceAgeMin = updates.preferenceAgeRange.get('min');
        apiUpdates.preferenceAgeMax = updates.preferenceAgeRange.get('max');
      }
      if (updates.preferenceGender !== undefined) {
        apiUpdates.preferenceGender = updates.preferenceGender;
      }
      if (updates.favoriteGames !== undefined) {
        apiUpdates.favoriteGames = updates.favoriteGames;
      }
      if (updates.otherGames !== undefined) {
        apiUpdates.otherGames = updates.otherGames;
      }

      const updatedProfile = await api.updateProfile(apiUpdates);
      console.log('Profile updated successfully:', updatedProfile);

      // Refresh profile to get latest data
      await fetchProfile();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  return { profile, loading, error, updateProfile, refresh: fetchProfile };
}

