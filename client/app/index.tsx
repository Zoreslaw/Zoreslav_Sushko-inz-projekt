import { StyleSheet, Text, View } from "react-native";
import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        router.replace("/home");
      } else {
        router.replace("/sign-in");
      }
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return null; // or a loading spinner
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  textTest: {
    fontFamily: "Roboto_400Regular",
    fontSize: 36,
  },
  textTestMedium: {
    fontFamily: "Roboto_500Medium",
    fontSize: 36,
  },
});
