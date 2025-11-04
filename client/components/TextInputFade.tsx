import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function FadeExample() {
  const [text] = useState(
    'Lorem ipsum dolor sit amet, '.repeat(50)
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, padding: 12 }}>{text}</Text>
        </ScrollView>

        {/* Fade at the top */}
        <View style={styles.fadeContainer}>
          <LinearGradient
            colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fadeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },
});
