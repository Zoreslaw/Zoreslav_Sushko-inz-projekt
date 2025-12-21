import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AvatarPlaceholderProps {
  size?: number;
  name?: string;
  backgroundColor?: string;
  textColor?: string;
}

export default function AvatarPlaceholder({
  size = 56,
  name,
  backgroundColor = '#E6E6E6',
  textColor = '#494949',
}: AvatarPlaceholderProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      {initials ? (
        <Text
          style={[
            styles.initials,
            {
              fontSize: size * 0.4,
              color: textColor,
            },
          ]}
        >
          {initials}
        </Text>
      ) : (
        <MaterialCommunityIcons name="account" size={size * 0.6} color={textColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '600',
    textAlign: 'center',
  },
});


