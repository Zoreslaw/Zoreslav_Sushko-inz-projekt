import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, StyleSheet, LayoutChangeEvent } from 'react-native';

interface ProfileAnimatedSubmenuProps {
  isExpanded: boolean;
  children: React.ReactNode;
  duration?: number;
}

const ProfileAnimatedSubmenu = ({
  isExpanded,
  children,
  duration = 300,
}: ProfileAnimatedSubmenuProps) => {
  const [contentHeight, setContentHeight] = useState(0);
  const heightAnim = useRef(new Animated.Value(0)).current;
  //const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const computedDuration = contentHeight
      ? Math.max(300, Math.min(600, contentHeight * 1.3))
      : duration;
      
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isExpanded ? contentHeight : 0,
        duration: computedDuration,
        useNativeDriver: false,
      }),
      // Animated.timing(opacityAnim, {
      //   toValue: isExpanded ? 1 : 0,
      //   duration: computedDuration,
      //   useNativeDriver: false,
      // }),
    ]).start();
  }, [isExpanded, contentHeight]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    if (measuredHeight && measuredHeight !== contentHeight) {
      setContentHeight(measuredHeight);
    }
  };

  const translateY = heightAnim.interpolate({
    inputRange: [0, contentHeight],
    outputRange: [-contentHeight, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY }]/*, opacity: opacityAnim */}}>
        <View onLayout={onLayout} style={styles.hiddenContent}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  hiddenContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

export default ProfileAnimatedSubmenu;
