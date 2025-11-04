import { useEffect, useState } from 'react';
import {
  getFirestore,
  doc as docRef,
  onSnapshot,
  updateDoc,
} from '@react-native-firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

export interface UserProfile {
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

export interface UserProfileUpdate {
  photoURL?: string;
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
  profile: UserProfile;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: UserProfileUpdate) => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    avatarUrl: '',
    userName: '' ,
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
  const db = getFirestore();

  const updateProfile = async (updates : UserProfileUpdate) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    try {
      const updatePayload: any = {};

      if (updates.photoURL !== undefined) {
        updatePayload.photoURL = updates.photoURL;
      }
      if (updates.displayName !== undefined) {
        updatePayload.displayName = updates.displayName;
      }
      if (updates.favoriteCategory !== undefined) {
        updatePayload.favoriteCategory = updates.favoriteCategory;
      }
      if (updates.languages !== undefined) {
        updatePayload.languages = updates.languages;
      }
      if (updates.age !== undefined) {
        updatePayload.age = (updates.age === '') ? null : Number(updates.age);
      }
      if (updates.gender !== undefined) {
        updatePayload.gender = updates.gender;
      }
      if (updates.description !== undefined) {
        updatePayload.description = updates.description;
      }
      if (updates.preferenceCategories !== undefined) {
        updatePayload.preferenceCategories = updates.preferenceCategories;
      }
      if (updates.preferenceLanguages !== undefined) {
        updatePayload.preferenceLanguages = updates.preferenceLanguages;
      }
      if (updates.preferenceAgeRange instanceof Map) {
        updatePayload.preferenceAgeRange = Object.fromEntries(updates.preferenceAgeRange);
      }
      if (updates.preferenceGender !== undefined) {
        updatePayload.preferenceGender = updates.preferenceGender;
      }
      if (updates.favoriteGames !== undefined) {
        updatePayload.favoriteGames = updates.favoriteGames;
      }
      if (updates.otherGames !== undefined) {
        updatePayload.otherGames = updates.otherGames;
      }

      const ref = docRef(db, 'users', user.uid);
      await updateDoc(ref, updatePayload);
      console.log('Profile updated successfully:', updatePayload);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const userDocRef = docRef(db, 'users', user.uid)
    
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        try {
          if (!snap.exists) {
            setError('User does not exist');
            setLoading(false);
            return;
          }

          const userData = snap.data() || {};
          const url = userData.photoURL || '';
          const name = userData.displayName || 'NoName';
          const favoriteCategory = userData.favoriteCategory || '';
          const languages = userData.languages || [];
          const age = userData.age || null;
          const gender = userData.gender || '';
          const description = userData.description || '';
          const preferredCategories = userData.preferenceCategories || [];
          const preferredLanguages = userData.preferenceLanguages || [];
          const preferredAgeRangeRaw = userData.preferenceAgeRange || {};
          const preferredAgeRange = new Map<string, number>(Object.entries(preferredAgeRangeRaw));
          const preferredGender = userData.preferenceGender || '';
          const favoriteGames = userData.favoriteGames || [];
          const otherGames = userData.otherGames || [];
          setProfile({
            avatarUrl: url,
            userName: name,
            favoriteCategory: favoriteCategory,
            languages: languages,
            age: age,
            gender: gender,
            description: description,
            preferredCategories: preferredCategories,
            preferredLanguages: preferredLanguages,
            preferredAgeRange: preferredAgeRange,
            preferredGender: preferredGender,
            favoriteGames: favoriteGames,
            otherGames: otherGames,
          });
          setLoading(false);
        } catch (err: any) {
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  return { profile, loading, error, updateProfile };
}