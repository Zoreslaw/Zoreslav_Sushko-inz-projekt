import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, Platform, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, ActivityIndicator, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
  const [touched, setTouched] = useState({ email: false, password: false, displayName: false });
  const backgroundColor = useThemeColor({}, "background");
  const primaryColor = useThemeColor({}, "tint");

  const { t } = useTranslation();
  const t_signIn = t("sign-in-page.sign-in");
  const t_signUp = "Sign Up";
  const t_email = "Email";
  const t_password = "Password";
  const t_displayName = "Display Name";
  const t_welcomeWords = t("sign-in-page.welcome-words");

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user]);

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = displayName.trim();

  const emailError = useMemo(() => {
    if (!trimmedEmail) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) return "Enter a valid email address";
    return "";
  }, [trimmedEmail]);

  const displayNameError = useMemo(() => {
    if (!isSignUp) return "";
    if (!trimmedName) return "Display name is required";
    if (trimmedName.length < 3) return "Display name should be at least 3 characters";
    if (trimmedName.length > 24) return "Display name must be under 24 characters";
    return "";
  }, [isSignUp, trimmedName]);

  const passwordError = useMemo(() => {
    if (!password) return "Password is required";
    if (password.includes(" ")) return "Password cannot include spaces";
    if (isSignUp) {
      if (password.length < 8) return "Use at least 8 characters";
      const hasNumber = /\d/.test(password);
      const hasLetter = /[A-Za-z]/.test(password);
      if (!hasNumber || !hasLetter) return "Use at least 1 letter and 1 number";
    }
    return "";
  }, [password, isSignUp]);

  const canSubmit = useMemo(() => {
    if (loading || authLoading) return false;
    if (isSignUp) {
      return !emailError && !passwordError && !displayNameError;
    }
    return !emailError && !passwordError;
  }, [loading, authLoading, isSignUp, emailError, passwordError, displayNameError]);
  const isDisabled = !canSubmit;

  const handleSubmit = async () => {
    setError("");
    setTouched({ email: true, password: true, displayName: true });

    if (emailError || passwordError || displayNameError) {
      setError("Please fix the highlighted fields");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(trimmedName, trimmedEmail, password);
      } else {
        await signIn(trimmedEmail, password);
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
    setTouched({ email: false, password: false, displayName: false });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ImageBackground
        source={require("@/assets/images/auth-hero.png")}
        resizeMode="cover"
        style={styles.heroBackground}
      >
        <LinearGradient
          colors={["rgba(10, 8, 18, 0.88)", "rgba(12, 14, 30, 0.6)", "rgba(12, 12, 22, 0.92)"]}
          style={styles.heroOverlay}
        />
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <View style={styles.topArea}>
                <AuthHeader containerStyle={styles.headerPosition} logoColor="#fff" />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroSubtitle}>
                    Match with players, drop into a vibe, and start the party.
                  </Text>
                  <View style={styles.vibeRow}>
                    {(
                      [
                        { label: "Chill", helper: "Relaxed matches and low stakes.", accent: "#60f1d0" },
                        { label: "Competitive", helper: "Ranked energy, serious squads.", accent: "#ff9b3f" },
                        { label: "Party", helper: "Loud lobbies and fast invites.", accent: "#ff6ad5" },
                      ] as const
                    ).map((option) => (
                      <View key={option.label} style={styles.vibeCardStatic}>
                        <View style={[styles.vibeDot, { backgroundColor: option.accent }]} />
                        <View style={styles.vibeCopy}>
                          <Text style={styles.vibeTitle}>{option.label}</Text>
                          <Text style={styles.vibeSubtitle}>{option.helper}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.bottomContainer}>
                <View style={styles.formCard}>
                  <View style={styles.modeToggle}>
                    <TouchableOpacity
                      style={[styles.modeButton, !isSignUp && styles.modeButtonActive]}
                      onPress={() => {
                        if (isSignUp) toggleMode();
                      }}
                      disabled={loading}
                    >
                      <Text style={[styles.modeText, !isSignUp && styles.modeTextActive]}>
                        {t_signIn}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeButton, isSignUp && styles.modeButtonActive]}
                      onPress={() => {
                        if (!isSignUp) toggleMode();
                      }}
                      disabled={loading}
                    >
                      <Text style={[styles.modeText, isSignUp && styles.modeTextActive]}>
                        {t_signUp}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formTitle}>
                    {isSignUp ? "Make your entrance" : "Welcome back, star"}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {isSignUp
                      ? "Pick a nickname and we will set the stage."
                      : "Your squad is waiting."}
                  </Text>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {isSignUp && (
                    <TextInput
                      style={[
                        styles.input,
                        touched.displayName && displayNameError && styles.inputError,
                      ]}
                      placeholder={t_displayName}
                      placeholderTextColor="rgba(255, 255, 255, 0.7)"
                      value={displayName}
                      onChangeText={setDisplayName}
                      onBlur={() => setTouched((prev) => ({ ...prev, displayName: true }))}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  )}
                  {isSignUp && touched.displayName && displayNameError ? (
                    <Text style={styles.fieldError}>{displayNameError}</Text>
                  ) : null}

                  <TextInput
                    style={[styles.input, touched.email && emailError && styles.inputError]}
                    placeholder={t_email}
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                  />
                  {touched.email && emailError ? (
                    <Text style={styles.fieldError}>{emailError}</Text>
                  ) : null}

                  <TextInput
                    style={[styles.input, touched.password && passwordError && styles.inputError]}
                    placeholder={t_password}
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={isSignUp ? "newPassword" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  {touched.password && passwordError ? (
                    <Text style={styles.fieldError}>{passwordError}</Text>
                  ) : (
                    <Text style={styles.fieldHint}>
                      {isSignUp ? "Use 8+ chars with a letter and a number." : "Enter your password."}
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isDisabled}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#ff4d7f", "#ff924d", "#ffd24d"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.submitButton, isDisabled && styles.submitButtonDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#1a0f24" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          {isSignUp ? t_signUp : t_signIn}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                </View>

                <AuthBottomText
                  textStyle={styles.bottomText}
                  containerStyle={styles.bottomTextContainer}
                >
                  {t_welcomeWords}
                </AuthBottomText>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBackground: {
    flex: 1,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topArea: {
    minHeight: 320,
    justifyContent: "space-between",
  },
  headerPosition: {
    alignItems: "flex-start",
    paddingTop: 40,
  },
  heroCopy: {
    paddingBottom: 18,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.82)",
    lineHeight: 22,
  },
  vibeRow: {
    marginTop: 18,
    gap: 10,
  },
  vibeCardStatic: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  vibeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  vibeCopy: {
    flex: 1,
  },
  vibeTitle: {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 14,
    fontWeight: "700",
  },
  vibeSubtitle: {
    marginTop: 2,
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 32,
  },
  formCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "rgba(19, 20, 40, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  modeText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontWeight: "600",
    fontSize: 14,
  },
  modeTextActive: {
    color: "#fff",
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textAlign: "left",
  },
  formSubtitle: {
    marginTop: 6,
    marginBottom: 18,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 77, 125, 0.2)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#ffd6e1",
    textAlign: "left",
    fontSize: 14,
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    color: "#fff",
  },
  inputError: {
    borderColor: "rgba(255, 107, 140, 0.9)",
  },
  fieldError: {
    color: "#ffd6e1",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
  fieldHint: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#1a0f24",
    fontSize: 18,
    fontWeight: "700",
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
  bottomTextContainer: {
    marginTop: 16,
    paddingBottom: 12,
  },
  bottomText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
});
