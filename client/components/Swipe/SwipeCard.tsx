import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ModalRN from 'react-native-modal';
// Import MaterialCommunityIcons
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarPlaceholder from '@/components/AvatarPlaceholder';

interface SwipeCardProps {
  card: {
    user?: {
      displayName?: string;
      photoURL?: string;
      favoriteGames?: string[];
      bio?: string;
    };
  };
  overlay?: any;
  style?: any;
}

const { width } = Dimensions.get('window');

export default function SwipeCard({ card, overlay, style }: SwipeCardProps) {
  const [showBio, setShowBio] = useState(false);

  if (!card?.user) {
    return <View />;
  }

  const hasValidPhoto = card.user.photoURL && card.user.photoURL.trim() !== '';

  return (
    <>
      {/* Main card container */}
      <View style={[styles.cardContainer, style]}>
        {hasValidPhoto ? (
          <ImageBackground
            source={{ uri: card.user.photoURL }}
            style={styles.cardImage}
            imageStyle={styles.cardImageStyle}
          >
          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.9)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Optional extra overlay */}
          <View style={overlay || styles.defaultOverlay} />

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text style={styles.nameText}>{card.user.displayName}</Text>

            {/* "User BIO" pill */}
            <TouchableOpacity
              style={styles.bioBadge}
              onPress={() => setShowBio(true)}
            >
              <Text style={styles.bioBadgeText}>User BIO</Text>

              {/* 
                Info icon in a small circle 
                Using MaterialCommunityIcons from @expo/vector-icons
              */}
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={12}
                  color="#FFF"
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.favGamesLabel}>Favorite games:</Text>
            <Text style={styles.favGamesValue}>
              {card.user.favoriteGames?.join(', ') || 'No favorites'}
            </Text>
          </View>
        </ImageBackground>
        ) : (
          <View style={styles.cardImage}>
            <View style={styles.placeholderContainer}>
              <View style={styles.placeholderBackground} />
              <AvatarPlaceholder
                size={Math.min(width * 0.6, 300)}
                name={card.user.displayName}
                backgroundColor="rgba(255, 255, 255, 0.15)"
                textColor="#FFF"
              />
            </View>
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.9)']}
              style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]}
            />
            <View style={[overlay || styles.defaultOverlay, { zIndex: 1 }]} />
            <View style={styles.textContainer}>
              <Text style={styles.nameText}>{card.user.displayName}</Text>
              <TouchableOpacity
                style={styles.bioBadge}
                onPress={() => setShowBio(true)}
              >
                <Text style={styles.bioBadgeText}>User BIO</Text>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={12}
                    color="#FFF"
                  />
                </View>
              </TouchableOpacity>
              <Text style={styles.favGamesLabel}>Favorite games:</Text>
              <Text style={styles.favGamesValue}>
                {card.user.favoriteGames?.join(', ') || 'No favorites'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Full screen modal for extended bio */}
      <ModalRN
        isVisible={showBio}
        onBackdropPress={() => setShowBio(false)}
        onBackButtonPress={() => setShowBio(false)}
        style={styles.fullModal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{card.user.displayName} — Bio</Text>
          <ScrollView>
            <Text style={styles.modalBody}>
              {card.user.bio || 'No extended bio provided.'}
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowBio(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </ModalRN>
    </>
  );
}

const styles = StyleSheet.create({
  /* Card Layout */
  cardContainer: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    width: '100%',
    maxHeight: '88%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  cardImageStyle: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  placeholderBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  defaultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  textContainer: {
    padding: 20,
    width: '100%',
    zIndex: 10,
    position: 'relative',
  },

  /* Name style */
  nameText: {
    fontFamily: 'Roboto',
    fontWeight: '900',
    fontSize: 32,
    color: '#F7F7F7',
    marginBottom: 8,
  },

  /* "User BIO" pill */
  bioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#5400FF',
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  bioBadgeText: {
    fontFamily: 'Montserrat',
    fontWeight: '600',
    fontSize: 11,
    color: '#F7F7F7',
    marginRight: 6,
  },
  iconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(51,0,153,1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* "Favorite games:" */
  favGamesLabel: {
    fontFamily: 'Roboto',
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 28,
    color: '#FFF',
    marginBottom: 8,
  },
  favGamesValue: {
    fontFamily: 'Righteous',
    fontSize: 16,
    lineHeight: 26,
    color: '#FFF',
  },

  /* Full-Screen Modal (Bottom Sheet) */
  fullModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 16,
    color: '#CCC',
    lineHeight: 22,
  },
  closeButton: {
    alignSelf: 'center',
    marginVertical: 20,
    backgroundColor: '#A100FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '700',
  },
});
