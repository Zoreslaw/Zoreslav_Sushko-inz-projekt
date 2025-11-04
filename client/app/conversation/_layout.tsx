import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ConversationLayout() {
  const backgroundColor = useThemeColor({}, 'background');
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
