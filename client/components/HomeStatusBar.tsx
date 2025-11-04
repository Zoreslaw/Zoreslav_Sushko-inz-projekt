import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

/**
 * A custom "fake" status bar with time, wifi, signal, battery, etc.
 * In real apps, you often just use the system status bar, but here
 * we replicate your design with absolute positioning.
 */
export function HomeStatusBar() {
  return (
    <View style={styles.statusBarContainer}>
      {/* Time */}
      <Text style={styles.timeText}>9:30</Text>

      {/* Right icons container */}
      <View style={styles.rightIcons}>
        {/* Wifi, signal, battery, etc. 
            For example, place Ionicons or custom SVGs here. */}
        <Text style={{ color: '#fff' }}>Wi-Fi Icon</Text>
        <Text style={{ color: '#fff' }}>Signal Icon</Text>
        <Text style={{ color: '#fff' }}>Battery Icon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 10,
    zIndex: 999,
  },
  timeText: {
    fontFamily: 'Roboto',
    fontSize: 14,
    color: '#FEF7FF',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // iOS/Android might not support 'gap'. Use marginRight on children if needed
  },
});
