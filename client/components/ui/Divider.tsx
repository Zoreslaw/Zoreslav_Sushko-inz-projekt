import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface DividerProps {  
  color?: string;
}

export const Divider = ({ color }: DividerProps) => {
  const secondaryBackgroundColor = useThemeColor({}, 'secondaryBackground');
  return <View style={[styles.divider, { backgroundColor: color || secondaryBackgroundColor }]} />;
};

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
});

