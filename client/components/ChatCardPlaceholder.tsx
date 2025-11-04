import React from 'react';
import { StyleSheet } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

import { useThemeColor } from '../hooks/useThemeColor';

export default function ChatCardPlaceholder() {
  const secondaryBackground = useThemeColor({}, 'secondaryBackground');

  return (
    <SkeletonPlaceholder.Item style={[styles.container, { backgroundColor: secondaryBackground }]}>
      <SkeletonPlaceholder.Item width={56} height={56} borderRadius={28} style={{ backgroundColor: secondaryBackground }} />
      <SkeletonPlaceholder.Item marginLeft={14}>
      <SkeletonPlaceholder.Item width={120} height={14} borderRadius={4} style={{ backgroundColor: secondaryBackground }} />
      <SkeletonPlaceholder.Item marginTop={6} width={180} height={12} borderRadius={4} style={{ backgroundColor: secondaryBackground }} />
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder.Item>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
