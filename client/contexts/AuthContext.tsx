import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { api, AuthUser } from '@/services/api';

type AuthContextType = {
  user: AuthUser | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthUser | undefined>;
  signUp: (name: string, email: string, password: string) => Promise<AuthUser | undefined>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateUsername: (newUsername: string) => Promise<void>;
  updateAvatar: (uri: string) => Promise<void>;
};

const ERROR_MESSAGES: { [key: string]: string } = {
  'Invalid email or password': 'Houston, we have a problem. Your email or password didn\'t quite make it.',
  'Email already registered': 'That email address is already in use.',
  'Session expired. Please login again.': 'Your session has expired. Please login again.',
  unknown: 'Well, this is awkward. Something went wrong.',
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const segments = useSegments();

  // Heartbeat interval ref
  const heartbeatInterval = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = await api.getStoredUser();
        const token = await api.getStoredToken();
        
        if (storedUser && token) {
          setUser(storedUser);
          // Start presence heartbeat
          startHeartbeat();
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setLoading(false);
      }
    };

    // Set up auth change handler
    api.setAuthChangeHandler((newUser) => {
      setUser(newUser);
      if (newUser) {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    });

    initAuth();

    return () => {
      stopHeartbeat();
    };
  }, []);

  // Handle app state changes for presence
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (!user) return;

    try {
      if (nextAppState === 'active') {
        await api.setPresence(true);
        startHeartbeat();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        await api.setPresence(false);
        stopHeartbeat();
      }
    } catch (err) {
      console.error('Error updating presence:', err);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatInterval.current) return;
    
    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(async () => {
      try {
        await api.heartbeat();
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    }, 30000);

    // Initial heartbeat
    api.heartbeat().catch(console.error);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  };

  // Clear error on navigation
  useEffect(() => {
    clearError();
  }, [segments]);

  const handleAuthError = (err: any) => {
    const message = err?.message || 'unknown';
    const errorMessage = ERROR_MESSAGES[message] || ERROR_MESSAGES['unknown'];
    setError(errorMessage);
    Alert.alert('Error', errorMessage);
    console.error('Auth error:', err);
  };

  const signIn = async (email: string, password: string): Promise<AuthUser | undefined> => {
    try {
      setError(null);
      console.log('Sign in with email:', email);
      
      const response = await api.login(email, password);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        displayName: response.displayName,
        photoUrl: response.photoUrl,
      };
      
      setUser(authUser);
      console.log('User signed in successfully:', response.userId);
      return authUser;
    } catch (err: any) {
      handleAuthError(err);
      return undefined;
    }
  };

  const signUp = async (name: string, email: string, password: string): Promise<AuthUser | undefined> => {
    try {
      setError(null);
      console.log('Sign up:', { name, email });
      
      const response = await api.register(email, password, name);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        displayName: response.displayName,
        photoUrl: response.photoUrl,
      };
      
      setUser(authUser);
      console.log('User registered successfully:', response.userId);
      return authUser;
    } catch (err: any) {
      handleAuthError(err);
      return undefined;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      console.log('Sign out');

      // Set offline before logout
      await api.setPresence(false).catch(console.error);
      
      // Logout from backend
      await api.logout();

      setUser(null);
      console.log('User signed out successfully');
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const clearError = () => {
    if (error) setError(null);
  };

  const updateUsername = async (newUsername: string): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');

      console.log('Updating username to:', newUsername);
      await api.updateProfile({ displayName: newUsername });
      
      setUser({ ...user, displayName: newUsername });
      console.log('Username updated successfully');
    } catch (err: any) {
      handleAuthError(err);
      throw err;
    }
  };

  const updateAvatar = async (uri: string): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');

      console.log('Updating avatar...');
      const result = await api.uploadAvatar(uri);
      
      setUser({ ...user, photoUrl: result.photoUrl });
      console.log('Avatar updated successfully');
    } catch (err: any) {
      handleAuthError(err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.userId || null,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        clearError,
        updateUsername,
        updateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

