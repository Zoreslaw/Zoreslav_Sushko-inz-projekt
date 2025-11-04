import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DislikeButtonIcon from '@/components/svgs/DislikeButtonIcon';
import LikeButtonIcon from '@/components/svgs/LikeButtonIcon';

interface SwipeBottomBarProps {
  onDislike: () => void;
  onLike: () => void;
}

export default function SwipeBottomBar({
  onDislike,
  onLike,
}: SwipeBottomBarProps) {
  return (
    <View style={styles.bottomBar}>
      {/* Dislike */}
      <TouchableOpacity
        style={[styles.circleButton, { borderColor: '#FF5E51' }]}
        onPress={onDislike}
      >
        <DislikeButtonIcon />
      </TouchableOpacity>


      {/* Like */}
      <TouchableOpacity
        style={[styles.circleButton, { borderColor: '#00D387' }]}
        onPress={onLike}
      >
        <LikeButtonIcon />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    bottom: 16,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  circleButton: {
    width: 62,
    height: 62,
    borderWidth: 2,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCircleButton: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
