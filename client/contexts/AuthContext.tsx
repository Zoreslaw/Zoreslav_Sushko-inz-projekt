import React, { createContext, useState, useEffect, ReactNode } from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { useSegments } from "expo-router";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import database from "@react-native-firebase/database";
type AuthContextType = {
  user: FirebaseAuthTypes.User | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<FirebaseAuthTypes.UserCredential | undefined>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<FirebaseAuthTypes.UserCredential | undefined>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<FirebaseAuthTypes.UserCredential | undefined>;
  signInWithApple: () => Promise<FirebaseAuthTypes.UserCredential | undefined>;
  clearError: () => void;
  updateUsername: (newUsername: string) => Promise<void>;
  updateAvatar: (uri: string) => Promise<void>;
};

const ERROR_CODES: { [key: string]: string } = {
  "auth/invalid-email": "The email address is not valid.",
  "auth/user-disabled": "This user account has been disabled.",
  "auth/user-not-found": "There is no user corresponding to this email.",
  "auth/wrong-password": "The password is invalid for the given email.",
  "auth/invalid-credential":
    "Houston, we have a problem. Your email or password didn't quite make it.",
  "auth/email-already-in-use": "That email address is already in use.",
  "auth/operation-not-allowed":
    "Well, this is awkward. Something went wrong, but we're not sure what. It's like a mystery novel, but less fun.",
  "auth/weak-password": "The password is not strong enough.",
  unknown: "Well, this is awkward. Error is unknown",
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

console.log("IS_DEV", __DEV__);
GoogleSignin.configure({
  webClientId:
    "557470981427-03c3mk56mknb028felssqmhu7rdmh8kl.apps.googleusercontent.com",
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const segments = useSegments();

  console.log(
    "STATE:",
    `user: ${user?.uid || "null"}`,
    `loading: ${loading}`,
    `error: ${error}`,
  );

  // Helper function to ensure a Firestore user document exists
  const ensureUserDocument = async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      const userDocRef = firestore().collection("users").doc(firebaseUser.uid);
      const docSnapshot = await userDocRef.get();
      if (!docSnapshot.exists) {
        await userDocRef.set({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || "Anonymous",
          createdAt: firestore.FieldValue.serverTimestamp(),
          photoURL: firebaseUser.photoURL || "",
        });
        console.log("Created Firestore user document for", firebaseUser.uid);
      }
    } catch (error) {
      console.error("Error ensuring user document:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (_user) => {
      console.log("Firebase onAuthStateChanged", JSON.stringify(_user, null, 2));
      if (_user) {
        await ensureUserDocument(_user);
      }
      if (JSON.stringify(user) !== JSON.stringify(_user)) {
        setUser(_user);
      }
      if (loading) setLoading(false);

      if (_user) {
        console.log("AnalyticsService.logSessionStart", _user.uid);
      } else {
        console.log("AnalyticsService.logSessionEnd");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const connectionRef = database().ref('.info/connected');
    const userStatusRef = database().ref(`/status/${uid}`);

    const onConnected = connectionRef.on('value', snapshot => {
      if (snapshot.val() !== true) {
        console.log("Not connected; do nothing.");
        return;
      }

      userStatusRef
        .onDisconnect()
        .remove()
        .then(() => {
          userStatusRef.set(true);
          console.log("User is online");
        });
    });

    return () => {
      connectionRef.off('value', onConnected);
    };
  }, [user]);

  useEffect(() => {
    clearError();
  }, [segments]);

  const handleAuthError = (err: any) => {
    const errorMessage = ERROR_CODES[err.code] || ERROR_CODES["unknown"];
    setError(errorMessage);
    Alert.alert("Error", JSON.stringify(err));
    console.error(JSON.stringify(err));
    console.error(errorMessage);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      console.log("sign in with email:", email);
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password,
      );
      console.log("User signed in successfully", {
        userId: userCredential.user.uid,
      });
      return userCredential;
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      console.log("sign up:", { name, email });
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );
      await userCredential.user.updateProfile({ displayName: name });
      await ensureUserDocument(userCredential.user);
      console.log("User account created & signed in", {
        userId: userCredential.user.uid,
      });
      return userCredential;
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      console.log("sign out");
      
      // 1) Sign out from Firebase
      await auth().signOut();
      
      // 2) Also sign out from Google
      GoogleSignin.signOut().then(() => {
        console.log("Google signed out");
      }).catch((err: any) => {
        console.error("Error signing out from Google", err);
      });

      // 3) Sign out from Apple
      // await AppleAuthentication.signOutAsync({
      //   user: user?.uid || "unknown_user",
      // });
  
      console.log("User signed out from Firebase and Google", {
        userId: user?.uid || "unknown_user",
      });

      console.log("AnalyticsService.logSessionEnd", user?.uid || null);
  
      // Clear local user state
      setUser(null);
  
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      console.log("signInWithGoogle");
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        console.warn("Failed to retrieve ID token");
        return;
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      console.log("AnalyticsService.logSignInWithGoogle");
      return userCredential;
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const signInWithApple = async () => {
    try {
      setError(null);
      console.log("signInWithApple");
      const { state, identityToken } = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const credential = auth.AppleAuthProvider.credential(
        identityToken,
        state || undefined,
      );
      const userCredential = await auth().signInWithCredential(credential);
      console.log("AnalyticsService.logSignInWithApple");
      return userCredential;
    } catch (err: any) {
      if (err.code === "ERR_CANCELED") {
        console.log("Apple Sign-In was canceled by the user");
      } else {
        handleAuthError(err);
      }
    }
  };

  const clearError = () => {
    if (error) setError(null);
  };

  const updateUsername = async (newUsername: string): Promise<void> => {
    try {
      if (!user) {
        throw new Error("No user is currently signed in.");
      }

      console.log("Updating username to:", newUsername);
      await auth().currentUser?.updateProfile({ displayName: newUsername });
      const updatedUser = await auth().currentUser;
      setUser(updatedUser);
      console.log("Username updated successfully", { userId: updatedUser?.uid });
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  // Updated uploadAvatarToStorage to match your Firebase Storage rules
  const uploadAvatarToStorage = async (uri: string, uid: string) => {
    try {
      const cleanedUri =
        Platform.OS === "android" && uri.startsWith("file://")
          ? uri.replace("file://", "")
          : uri;
      const filename = `users/${uid}/uploads/avatar`;
      const reference = storage().ref(filename);
      await reference.putFile(cleanedUri);
      const downloadURL = await reference.getDownloadURL();
      console.log("downloadURL", downloadURL);
      return downloadURL;
    } catch (err: any) {
      console.error("Error uploading avatar:", err);
      throw new Error(err.message || "Failed to upload avatar");
    }
  };

  const updateAvatar = async (uri: string): Promise<void> => {
    try {
      if (!user) {
        throw new Error("No user logged in");
      }

      console.log("Updating user avatar...");
      const downloadURL = await uploadAvatarToStorage(uri, user.uid);
      await auth().currentUser?.updateProfile({ photoURL: downloadURL });
      await auth().currentUser?.reload();
      const updatedUser = auth().currentUser;
      setUser(updatedUser);
      console.log("User avatar updated successfully", {
        userId: updatedUser?.uid,
      });
    } catch (err: any) {
      console.error("Error updating avatar:", err);
      handleAuthError(err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.uid || null,
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
