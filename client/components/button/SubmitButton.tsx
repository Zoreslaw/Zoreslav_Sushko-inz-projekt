import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';

type SubmitButtonProps = {
  label: string;
  style?: ViewStyle;
  onPress: () => void;
}

export function SubmitButton({ label, style, onPress }: SubmitButtonProps) {
  return(
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonbase,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonbase: {
    width: 150,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(49, 49, 49, 1)',
    borderRadius: 300,
    
  },
  buttonPressed: {
    backgroundColor: 'rgba(49, 49, 49, 0.6)',
  },
  buttonText: {
    fontFamily: 'Roboto',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0,
    color: '#F7F7F7',
  }
})