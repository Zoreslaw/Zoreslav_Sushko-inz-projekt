import React from 'react';
import { StyleSheet, View, ImageBackground, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface NeonBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const NeonBackground = ({ children, style }: NeonBackgroundProps) => {
  return (
    <View style={[styles.container, style]}>
      <ImageBackground
        source={require('@/assets/images/44487-800.jpg')}
        style={styles.imageBackground}
      >
        {/* Gradient overlay */}
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0.85)',
            'rgba(255, 0, 102, 0.6)',
            'rgba(85, 0, 255, 0.6)',
            'rgba(0, 0, 0, 0.85)',
          ]}
          style={styles.gradient}
        />
        {children}


        {/* 
          IMPORTANT: Render children on top of the gradient.
          If you want the gradient to appear above your content, 
          swap the order or tweak the zIndex, but usually you want
          the gradient behind your screen’s UI.
        */}
      </ImageBackground>
    </View>
  );
};

export default NeonBackground;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageBackground: {
    flex: 1,
    // The background image is behind everything
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    // Put any layout spacing/padding here if needed
  },
});
