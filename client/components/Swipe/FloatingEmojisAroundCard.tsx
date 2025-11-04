import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';

interface FloatingEmojisProps {
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
  emojiCount?: number;
}

/**
 * Spawns random emojis in random positions (within the
 * container width/height), animates them in and out.
 */
export function FloatingEmojisAroundCard({
  visible,
  containerWidth,
  containerHeight,
  emojiCount = 8,
}: FloatingEmojisProps) {
  const [emojis, setEmojis] = useState<number[]>([]);

  useEffect(() => {
    if (visible) {
      // Spawn 'emojiCount' items
      setEmojis(Array.from({ length: emojiCount }, (_, i) => i));
    } else {
      setEmojis([]);
    }
  }, [visible, emojiCount]);

  return (
    <View
      style={[
        styles.emojiContainer,
        { width: containerWidth, height: containerHeight },
      ]}
    >
      {emojis.map((_, i) => {
        // Random positions inside container
        const randomLeft = Math.random() * (containerWidth - 40);
        const randomTop = Math.random() * (containerHeight - 40);

        // Pick random emoji from a set
        const allEmojis = ['❤️', '✨', '🔥', '⭐', '🎉'];
        const emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];

        return (
          <Animatable.Text
            key={i}
            style={[
              styles.emojiText,
              {
                left: randomLeft,
                top: randomTop,
              },
            ]}
            animation={{
              0: {
                opacity: 0,
                transform: [{ scale: 0.5 }, { translateY: 0 }],
              },
              0.5: {
                opacity: 1,
                transform: [{ scale: 1.2 }, { translateY: 0 }],
              },
              1: {
                opacity: 0,
                transform: [{ scale: 1.2 }, { translateY: -10 }],
              },
            }}
            duration={4000}
            delay={i * 150}
            onAnimationEnd={() => {
              setEmojis((prev) => prev.filter((__, idx) => idx !== i));
            }}
          >
            {emoji}
          </Animatable.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emojiContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  emojiText: {
    position: 'absolute',
    fontSize: 28,
  },
});
