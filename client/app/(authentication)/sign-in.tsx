import React, { useState, useEffect } from "react";
import { View, StyleSheet, Platform, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AuthHeader from "@/components/authentication/AuthHeader";
import AuthBottomText from "@/components/authentication/AuthBottomText";

import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTranslation } from "react-i18next";

export default function SignIn() {
  const router = useRouter();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const inputBackground = useThemeColor({}, "card");
  const primaryColor = useThemeColor({}, "tint");

  const { t } = useTranslation();
  const t_signIn = t("sign-in-page.sign-in");
  const t_signUp = "Sign Up";
  const t_email = "Email";
  const t_password = "Password";
  const t_displayName = "Display Name";
  const t_welcomeWords = t("sign-in-page.welcome-words");
  const t_switchToSignUp = "Don't have an account? Sign up";
  const t_switchToSignIn = "Already have an account? Sign in";

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user]);

  const handleSubmit = async () => {
    setError("");
    
    if (!email || !password || (isSignUp && !displayName)) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(displayName, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <AuthHeader />

            <View style={styles.bottomContainer}>
              <View style={styles.formContainer}>
                <Text style={[styles.formTitle, { color: textColor }]}>
                  {isSignUp ? t_signUp : t_signIn}
                </Text>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {isSignUp && (
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
                    placeholder={t_displayName}
                    placeholderTextColor={textColor + "80"}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                )}

                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
                  placeholder={t_email}
                  placeholderTextColor={textColor + "80"}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
                  placeholder={t_password}
                  placeholderTextColor={textColor + "80"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: primaryColor }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isSignUp ? t_signUp : t_signIn}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={toggleMode}
                  disabled={loading}
                >
                  <Text style={[styles.switchButtonText, { color: primaryColor }]}>
                    {isSignUp ? t_switchToSignIn : t_switchToSignUp}
                  </Text>
                </TouchableOpacity>
              </View>

              <AuthBottomText>
                {t_welcomeWords}
              </AuthBottomText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 32,
  },
  formContainer: {
    marginTop: 40,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#ff000020",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff0000",
    textAlign: "center",
    fontSize: 14,
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 24,
    padding: 12,
  },
  switchButtonText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
});
