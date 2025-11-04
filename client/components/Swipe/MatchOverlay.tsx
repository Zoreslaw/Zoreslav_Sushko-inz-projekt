import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useRouter } from 'expo-router';
// Import our separate FloatingEmojisAroundCard component
import { FloatingEmojisAroundCard } from './FloatingEmojisAroundCard';

interface MatchOverlayProps {
  visible: boolean;
  matchedUser?: {
    id?: string;
    displayName?: string;
    photoURL?: string;
  };
  onClose?: () => void;
}

const { width } = Dimensions.get('window');

export default function MatchOverlay({
  visible,
  matchedUser,
  onClose,
}: MatchOverlayProps) {
  const router = useRouter();

  const handleChatPress = () => {
    if (matchedUser?.id) {
      router.push(`/chat/${matchedUser.id}`);
      onClose?.();
    }
  };

  if (!visible || !matchedUser) {
    return null;
  }

  return (
    <View style={styles.overlayContainer}>
      {/* Outer container with 'zoomIn' animation */}
      <Animatable.View
        style={styles.contentContainer}
        animation="zoomIn"
        duration={600}
        onAnimationEnd={() => {
          setTimeout(() => {
            onClose?.();
          }, 3000);
        }}
      >
        {/* The matched card (with 'pulse' animation) */}
        <Animatable.View
          style={styles.matchedCard}
          animation="pulse"
          iterationCount="infinite"
        >
          {/*
            Floating emojis behind the card's content
            Using the matchedCard size (width - 40, 480).
          */}
          <View style={styles.emojisBehind}>
            <FloatingEmojisAroundCard
              visible={visible}
              containerWidth={width - 40}
              containerHeight={480}
              emojiCount={10}
            />
          </View>

          {/* Actual card content (photo, badge, name, button) */}
          <View style={styles.photoContainer}>
            {matchedUser.photoURL ? (
              <Image
                source={{ uri: matchedUser.photoURL }}
                style={styles.userPhoto}
              />
            ) : (
              <View style={styles.placeholderPhoto} />
            )}
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>MATCH</Text>
            </View>
          </View>

          <Text style={styles.matchedName}>{matchedUser.displayName}</Text>

          <Animatable.View style={styles.buttonContainer} animation="fadeInUp" duration={300}>
            <TouchableOpacity style={styles.chatButton} onPress={handleChatPress}>
              <Text style={styles.chatButtonText}>Start Chatting</Text>
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>
      </Animatable.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    zIndex: 999,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  matchedCard: {
    width: width - 40,
    height: 480,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,

    position: 'relative', // so we can absolutely position the emojis
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // The layer behind card content that holds emojis
  emojisBehind: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // Card content
  photoContainer: {
    position: 'relative',
    marginBottom: 24,
    zIndex: 2,
  },
  userPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#A100FF',
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    borderWidth: 3,
    borderColor: '#A100FF',
  },
  matchBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#A100FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  matchedName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    zIndex: 2,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 2,
  },
  chatButton: {
    backgroundColor: '#A100FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
