import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

type SignOutButtonProps = {
  label: string;
  IconLeft?: React.ComponentType<{
    size: number;
    color: string;
    style: ViewStyle;
  }>;
  style?: ViewStyle;
  onPress?: () => void;
}

export function SignOutButton({ label, style, onPress }: SignOutButtonProps) {
  return(
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonbase,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Feather name="log-out" size={24} color="#F7F7F7" />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonbase: {
    width: 250,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(49, 49, 49, 1)',
    borderRadius: 300,
    paddingLeft: 30,
    
  },
  buttonPressed: {
    backgroundColor: 'rgba(30, 30, 30, 1)',
  },
  buttonText: {
    fontFamily: 'Roboto',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0,
    color: '#F7F7F7',
    marginLeft: 32,
  }
})