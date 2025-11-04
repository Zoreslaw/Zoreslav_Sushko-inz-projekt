import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';

type NeonButtonProps = {
  label: string;
  style?: ViewStyle;
  onPress?: () => void;
};

/**
 * A custom "Neon" style button. We'll mimic your "Find Teammate" style.
 * There's no true "hover" in mobile, but we can do press feedback.
 */
export function NeonButton({ label, style, onPress }: NeonButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    width: 226,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 2,
    borderColor: '#E3BDFF',
    borderRadius: 300,
    shadowColor: '#E3BDFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  buttonPressed: {
    // approximate "hover" style or pressed state
    borderColor: '#982DB7',
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: 'Montserrat',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#E3BDFF',
  },
});
