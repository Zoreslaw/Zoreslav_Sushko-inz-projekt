import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';

import { useThemeColor } from '../hooks/useThemeColor';

const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);

export default function ChatCardPlaceholder() {
  const secondaryBackground = useThemeColor({}, 'secondaryBackground');
  const backgroundGray = useThemeColor({}, 'backgroundGray');
  const shimmerColors = [secondaryBackground, backgroundGray, secondaryBackground];

  return (
    <View style={[styles.container, { backgroundColor: secondaryBackground }]}>
      <ShimmerPlaceholder
        width={56}
        height={56}
        shimmerColors={shimmerColors}
        style={[styles.avatar, { backgroundColor: secondaryBackground }]}
      />
      <View style={styles.textColumn}>
        <ShimmerPlaceholder
          width={120}
          height={14}
          shimmerColors={shimmerColors}
          style={[styles.line, { backgroundColor: secondaryBackground }]}
        />
        <ShimmerPlaceholder
          width={180}
          height={12}
          shimmerColors={shimmerColors}
          style={[styles.line, styles.lineSpacing, { backgroundColor: secondaryBackground }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  textColumn: {
    marginLeft: 14,
  },
  avatar: {
    borderRadius: 28,
  },
  line: {
    borderRadius: 4,
  },
  lineSpacing: {
    marginTop: 6,
  },
});
