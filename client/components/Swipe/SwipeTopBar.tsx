import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

import GameControllerIcon from '@/components/svgs/GameControllerIcon';
import CancelButtonIcon from '@/components/svgs/CancelButtonIcon';
import NotificationBellIcon from '@/components/svgs/NotificationBellIcon';


function TopRightIcon() {
  return <Text style={{ color: '#fff', fontSize: 20 }}>•••</Text>;
}

interface SwipeTopBarProps {
  onLeftPress?: () => void;
  onRightPress?: () => void;
}

export default function SwipeTopBar({
  onLeftPress,
  onRightPress,
}: SwipeTopBarProps) {
  return (
    <View>
      <View style={styles.topBar}>
        {/* Left Button */}
        <TouchableOpacity style={styles.topLeftBtn} onPress={onLeftPress}>
          <CancelButtonIcon />
        </TouchableOpacity>

        {/* Center Space (Game Controller Icon) */}


        {/* Right Button */}
        <TouchableOpacity style={styles.topRightBtn} onPress={onRightPress}>
          <NotificationBellIcon notificationCount={0} />
        </TouchableOpacity>
      </View>

      <View style={styles.topCenterSpace}>
        <GameControllerIcon />
      </View>
    </View>

  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    height: 52,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topLeftBtn: {
    width: 32,
    height: 32,
    // borderWidth: 1.5,
    // borderColor: '#E6E6E6',
    // borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenterSpace: {
    alignItems: 'center',
  },
  topRightBtn: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderColor: '#E6E6E6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
