import React, { useEffect } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GmailButton } from "@/components/authentication/buttons/GmailButton";
import { AppleButton } from "@/components/authentication/buttons/AppleButton";
import AuthHeader from "@/components/authentication/AuthHeader";
import AuthBottomText from "@/components/authentication/AuthBottomText";

import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTranslation } from "react-i18next";

export default function SignIn() {
  const router = useRouter();
  const { signInWithGoogle, signInWithApple, user } = useAuth();

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  const { t } = useTranslation();
  const t_signIn = t("sign-in-page.sign-in");
  const t_welcomeWords = t("sign-in-page.welcome-words");

  const onGoogleSignInPress = async () => {
    await signInWithGoogle();
  };

  const onAppleSignInPress = async () => {
    await signInWithApple();
  };

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <AuthHeader />

        <View style={styles.bottomContainer}>
          <View style={styles.formContainer}>
            <Text style={[styles.formTitle, { color: textColor }]}>{t_signIn}</Text>
            <GmailButton onPress={onGoogleSignInPress} />
            {Platform.OS === "ios" && <AppleButton onPress={onAppleSignInPress} />}
          </View>

          <AuthBottomText>
            {t_welcomeWords}
          </AuthBottomText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginTop: 32,
    gap: 200,
    paddingHorizontal: 64,
    // justifyContent: "space-between",
  },
  bottomContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  formContainer: {
    gap: 32,
  },
  formTitle: {
    fontSize: 37,
    fontFamily: "Roboto_500Medium",
    textAlign: "center",
    width: "100%",
  },
});
