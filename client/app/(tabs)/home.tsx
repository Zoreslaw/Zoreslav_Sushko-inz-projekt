import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { NeonButton } from '@/components/button/NeonButton';
import Button from '@/components/button/Button';
import NeonBackground from '@/components/NeonBackground';
import HomeTabHeader from '@/components/HomeTabHeader';
import { useAuth } from '@/hooks/useAuth';
// import { HomeStatusBar } from '@/components/HomeStatusBar'; // if you want a custom status bar
import { createRandomUser } from '@/utils/createRandomUser';
import ProfileCheckModal from '@/components/Swipe/ProfileCheckModal';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const [showProfileCheck, setShowProfileCheck] = useState(false);

  const handleSwipePress = async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData?.preferenceAgeRange || !userData?.preferenceGender || !userData?.gender) {
        setShowProfileCheck(true);
      } else {
        router.push('/swipe');
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      setShowProfileCheck(true);
    }
  };

  return (
    <NeonBackground style={styles.container}>
      <HomeTabHeader />
      <View style={styles.appContainer}>
        <View style={styles.homeContainer}>
          <NeonButton label="Find Teammate" onPress={handleSwipePress} />
        </View>
      </View>

      <ProfileCheckModal
        visible={showProfileCheck}
        onClose={() => setShowProfileCheck(false)}
      />
    </NeonBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
  },
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: '100%',
  },
});
