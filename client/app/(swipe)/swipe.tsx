import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { getFirestore, doc, updateDoc, arrayUnion } from '@react-native-firebase/firestore';

import { useAuth } from '@/hooks/useAuth';
import { useGetMatch } from '@/hooks/useGetMatch';
import SwipeTopBar from '@/components/Swipe/SwipeTopBar';
import SwipeCard from '@/components/Swipe/SwipeCard';
import SwipeBottomBar from '@/components/Swipe/SwipeBottomBar';
import MatchOverlay from '@/components/Swipe/MatchOverlay';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';

import { useSwipeActions } from '@/hooks/useSwipeActions';

export default function SwipeScreen() {
  const { user } = useAuth();
  const { cards, isLoading } = useGetMatch(user?.uid ?? '');
  const db = getFirestore();
  const backgroundColor = useThemeColor({}, 'background');
  const router = useRouter();

  const { likeUser, dislikeUser } = useSwipeActions(user?.uid);

  const swiperRef = useRef<Swiper<any>>(null);
  const [allCardsFinished, setAllCardsFinished] = useState(false);

  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);

  // Called when user swipes right
  const handleSwipedRight = async (cardIndex: number) => {
    if (!cards || !user) return;
    const swipedUser = cards[cardIndex]?.user;
    const isMatch = swipedUser?.liked.includes(user.uid);
    if (!swipedUser?.id) return;

    try {
      await likeUser({ id: swipedUser.id, isMatch: isMatch }, isMatch);

      if (isMatch) {
        setMatchedUser(swipedUser);
        setShowMatch(true);
      }
    } catch (error) {
      console.error('Error updating like status:', error);
    }
  };

  // Called when user swipes left
  const handleSwipedLeft = async (cardIndex: number) => {
    if (!cards || !user) return;
    const swipedUser = cards[cardIndex]?.user;
    if (!swipedUser?.id) return;

    try {
      await dislikeUser({ id: swipedUser.id });
    } catch (error) {
      console.error('Error updating dislike status:', error);
    }
  };

  // Close match overlay
  const handleMatchOverlayClose = () => {
    setShowMatch(false);
    setMatchedUser(null);
  };

  // Renders each card in the deck
  const renderCard = (card: any) => <SwipeCard card={card} />;

  // Bottom bar triggers
  const handleDislikePress = () => {
    swiperRef.current?.swipeLeft();
  };
  const handleLikePress = () => {
    swiperRef.current?.swipeRight();
  };

  // "Close" in top bar just goes back
  const handleClosePress = () => {
    router.back();
  };

  // If loading or no cards, show appropriate message
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <SwipeTopBar
          onLeftPress={handleClosePress}
          onRightPress={() => console.log('Top Right Pressed')}
        />
        <View style={styles.noUsersContainer}>
          <Text style={styles.noUsersText}>
            Finding matches for you...
          </Text>
        </View>
      </View>
    );
  }

  if (!cards || cards.length === 0 || allCardsFinished) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <SwipeTopBar
          onLeftPress={handleClosePress}
          onRightPress={() => console.log('Top Right Pressed')}
        />
        <View style={styles.noUsersContainer}>
          <Text style={styles.noUsersText}>
            No more matches found!{'\n'}Come back later to see new users.
          </Text>
          <TouchableOpacity
            style={styles.goHomeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.goHomeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <SwipeTopBar
        onLeftPress={handleClosePress}
        onRightPress={() => console.log('Top Right Pressed')}
      />

      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={cards ?? []}
          renderCard={renderCard}
          onSwipedLeft={handleSwipedLeft}
          onSwipedRight={handleSwipedRight}
          onSwipedAll={() => setAllCardsFinished(true)}
          backgroundColor="transparent"
          stackSize={2}
          horizontalSwipe
          verticalSwipe={false}
          cardStyle={{ top: 10 }}
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: 'rgba(255,0,0,0.3)',
                  color: '#fff',
                  fontSize: 18,
                  borderWidth: 1,
                  borderColor: '#fff',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 10,
                  marginLeft: -20,
                },
              },
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: 'rgba(0,255,0,0.3)',
                  color: '#fff',
                  fontSize: 18,
                  borderWidth: 1,
                  borderColor: '#fff',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 10,
                  marginLeft: 20,
                },
              },
            },
            top: {
              title: 'SUPER LIKE',
              style: {
                label: {
                  backgroundColor: 'rgba(0,166,255,0.3)',
                  color: '#fff',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: '#fff',
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              },
            },
          }}
        />
      </View>

      <SwipeBottomBar
        onDislike={handleDislikePress}
        onLike={handleLikePress}
      />

      <MatchOverlay
        visible={showMatch}
        matchedUser={matchedUser}
        onClose={handleMatchOverlayClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swiperContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noUsersContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noUsersText: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  goHomeButton: {
    backgroundColor: '#A100FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  goHomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
