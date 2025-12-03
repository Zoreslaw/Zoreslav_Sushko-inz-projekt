import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { api, AuthUser } from '@/services/api';

type AuthContextType = {
  user: AuthUser | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthUser | undefined>;
  signUp: (name: string, email: string, password: string) => Promise<AuthUser | undefined>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthUser | undefined>;
  signInWithApple: () => Promise<AuthUser | undefined>;
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

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '557470981427-03c3mk56mknb028felssqmhu7rdmh8kl.apps.googleusercontent.com',
});

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

      // Sign out from Google if needed
      try {
        await GoogleSignin.signOut();
        console.log('Google signed out');
      } catch (err) {
        console.error('Error signing out from Google:', err);
      }

      setUser(null);
      console.log('User signed out successfully');
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const signInWithGoogle = async (): Promise<AuthUser | undefined> => {
    try {
      setError(null);
      console.log('Sign in with Google');

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        console.warn('Failed to retrieve Google ID token');
        return undefined;
      }

      const response = await api.loginWithGoogle(idToken);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        displayName: response.displayName,
        photoUrl: response.photoUrl,
      };

      setUser(authUser);
      console.log('Google sign in successful:', response.userId);
      return authUser;
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Google sign-in cancelled');
      } else {
        handleAuthError(err);
      }
      return undefined;
    }
  };

  const signInWithApple = async (): Promise<AuthUser | undefined> => {
    try {
      setError(null);
      console.log('Sign in with Apple');

      const { identityToken } = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!identityToken) {
        console.warn('Failed to retrieve Apple identity token');
        return undefined;
      }

      const response = await api.loginWithApple(identityToken);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        displayName: response.displayName,
        photoUrl: response.photoUrl,
      };

      setUser(authUser);
      console.log('Apple sign in successful:', response.userId);
      return authUser;
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED') {
        console.log('Apple sign-in cancelled');
      } else {
        handleAuthError(err);
      }
      return undefined;
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
        signInWithGoogle,
        signInWithApple,
        clearError,
        updateUsername,
        updateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

