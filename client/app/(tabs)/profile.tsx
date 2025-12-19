import React, { useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, Alert, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { SignOutButton } from '@/components/button/SignOutButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, ProfileUpdate } from '@/hooks/useProfile';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileBar from '@/components/ProfileBar';
import ProfileMenuItem from '@/components/ProfileMenuItem';
import ProfileSubmenuItem from '@/components/ProfileSubmenuItem';
import ProfileAnimatedSubmenu from '@/components/ProfileAnimatedSubmenu';
import ProfileEditInput from '@/components/ProfileEditInput';
import ProfileEditArrayInput from '@/components/ProfileEditArrayInput';
import ProfileEditSelector from '@/components/ProfileEditSelector';
import ProfileEditMultiSelector from '@/components/ProfileEditMultiSelector';
import ProfileEditBottomSheet, { ProfileEditSheetRef } from '@/components/ProfileEditBottomSheet';
import languageMapEn, { reverseLanguageMapEn } from '@/localization/languageMaps';


export default function Profile() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user, signOut } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const router = useRouter();
  const [isBioPressed, setIsBioPressed] = useState(false);
  const [isPreferencesPressed, setIsPreferencesPressed] = useState(false);
  const [isGamesPressed, setIsGamesPressed] = useState(false);
  const [isSettingsPressed, setIsSettingsgPressed] = useState(false);
  const sheetRef = useRef<ProfileEditSheetRef>(null);

  const openSheet = (params: {
    title: string;
    content: React.ReactNode;
    onSubmit?: () => Promise<void> | void;
    useScrollView?: boolean;
  }) => {
    sheetRef.current?.open({
      title: params.title,
      content: params.content,
      onSubmit: params.onSubmit,
      useScrollView: params.useScrollView,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  const handlePhotoSource = () => {
    openSheet({
      title: 'Profile Photo',
      content: (
        <ProfileEditSelector
          options={['Camera', 'Gallery']}
          selected=""
          onSelect={async (source) => {
            if (!user) return;
  
            let result;
            if (source === 'Camera') {
              result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
            } else {
              result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
            }
  
            if (result?.canceled) return;
  
            const image = result.assets[0];
            const uploadResult = await api.uploadAvatar(image.uri);
            await updateProfile({ photoUrl: uploadResult.photoUrl });
  
            sheetRef.current?.close();
          }}
        />
      ),
    });
  };
  

  const handleNameEdit = () => {
    let value = profile.userName;
  
    openSheet({
      title: 'User Name',
      content: (
        <ProfileEditInput
          value={value}
          placeholder="Enter new user name"
          onChangeText={(v) => (value = v)}
        />
      ),
      onSubmit: async () => {
        const trimmed = value.trim();
        if (!trimmed) {
          Alert.alert('Invalid name');
          return;
        }
        if (trimmed !== profile.userName) {
          await updateProfile({ displayName: trimmed });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handleBio = async () => {
    setIsBioPressed(!isBioPressed);
  }

  const handlePreferences = async () => {
    setIsPreferencesPressed(!isPreferencesPressed);
  }

  const handleGames = async () => {
    setIsGamesPressed(!isGamesPressed);
  }

  const handleSettings = async () => {
    setIsSettingsgPressed(!isSettingsPressed);
  }

  const handleFavoriteCategory = () => {
    let value = profile.favoriteCategory ?? '';
  
    openSheet({
      title: 'Favorite Category',
      content: (
        <ProfileEditInput
          value={value}
          placeholder="Enter favorite category"
          onChangeText={(v) => (value = v)}
        />
      ),
      onSubmit: async () => {
        const trimmed = value.trim();
        if (trimmed !== profile.favoriteCategory) {
          await updateProfile({ favoriteCategory: trimmed });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handleLanguages = () => {
    const initial = (profile.languages ?? [])
      .map(code => reverseLanguageMapEn[code])
      .filter(Boolean);
  
    let selected = [...initial];
  
    openSheet({
      title: 'Languages',
      content: (
        <ProfileEditMultiSelector
          options={Object.keys(languageMapEn)}
          selected={initial}
          onChange={(v) => (selected = v)}
        />
      ),
      onSubmit: async () => {
        const mapped = selected
          .map(name => languageMapEn[name])
          .filter(Boolean);
  
        if (JSON.stringify(mapped) !== JSON.stringify(profile.languages)) {
          await updateProfile({ languages: mapped });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handleAge = () => {
    let value = profile.age?.toString() ?? '';
  
    openSheet({
      title: 'Age',
      content: (
        <ProfileEditInput
          value={value}
          isNumeric
          placeholder="Enter age"
          onChangeText={(v) => (value = v.replace(/[^0-9]/g, ''))}
        />
      ),
      onSubmit: async () => {
        if (value !== profile.age?.toString()) {
          await updateProfile({ age: value });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handleGender = () => {
    sheetRef.current?.open({
      title: 'Gender',
      content: (
        <ProfileEditSelector
          options={['Male', 'Female', 'Other']}
          selected={profile.gender}
          onSelect={(value) => {
            updateProfile({ gender: value });
            sheetRef.current?.close();
          }}
        />
      ),
    });
  };
  

  const handleDescription = () => {
    let value = profile.description ?? '';
  
    openSheet({
      title: 'Description',
      content: (
        <ProfileEditInput
          value={value}
          placeholder="Enter description"
          multiline
          onChangeText={(v) => (value = v)}
        />
      ),
      onSubmit: async () => {
        const trimmed = value.trim();
        if (trimmed !== profile.description) {
          await updateProfile({ description: trimmed });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handlePreferredCategories = () => {
    let value = [...(profile.preferredCategories ?? [])];
  
    openSheet({
      title: 'Preferred Categories',
      content: (
        <ProfileEditArrayInput
          arrayItems={value}
          placeholder="Enter categories"
          onArrayItemsChange={(v) => (value = v)}
        />
      ),
      useScrollView: false,
      onSubmit: async () => {
        if (JSON.stringify(value) !== JSON.stringify(profile.preferredCategories)) {
          await updateProfile({ preferenceCategories: value });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handlePreferredLanguages = () => {
    const initial = (profile.preferredLanguages ?? [])
      .map(code => reverseLanguageMapEn[code])
      .filter(Boolean);
  
    let selected = [...initial];
  
    openSheet({
      title: 'Preferred Languages',
      content: (
        <ProfileEditMultiSelector
          options={Object.keys(languageMapEn)}
          selected={initial}
          onChange={(v) => (selected = v)}
        />
      ),
      onSubmit: async () => {
        const mapped = selected
          .map(name => languageMapEn[name])
          .filter(Boolean);
  
        if (JSON.stringify(mapped) !== JSON.stringify(profile.preferredLanguages)) {
          await updateProfile({ preferenceLanguages: mapped });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handlePreferredAgeRangeMin = () => {
    let value = profile.preferredAgeRange?.get('min')?.toString() ?? '';
  
    openSheet({
      title: 'Preferred Min Age',
      content: (
        <ProfileEditInput
          value={value}
          isNumeric
          placeholder="Enter min age"
          onChangeText={(v) => (value = v.replace(/[^0-9]/g, ''))}
        />
      ),
      onSubmit: async () => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return;
  
        const updated = new Map(profile.preferredAgeRange);
        updated.set('min', parsed);
  
        await updateProfile({ preferenceAgeRange: updated });
        sheetRef.current?.close();
      },
    });
  };
  

  const handlePreferredAgeRangeMax = () => {
    let value = profile.preferredAgeRange?.get('max')?.toString() ?? '';
  
    openSheet({
      title: 'Preferred Max Age',
      content: (
        <ProfileEditInput
          value={value}
          isNumeric
          placeholder="Enter max age"
          onChangeText={(v) => (value = v.replace(/[^0-9]/g, ''))}
        />
      ),
      onSubmit: async () => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return;
  
        const updated = new Map(profile.preferredAgeRange);
        updated.set('max', parsed);
  
        await updateProfile({ preferenceAgeRange: updated });
        sheetRef.current?.close();
      },
    });
  };
  

  const handlePreferredGender = () => {
    openSheet({
      title: 'Preferred Gender',
      content: (
        <ProfileEditSelector
          options={['Any', 'Male', 'Female', 'Other']}
          selected={profile.preferredGender}
          onSelect={async (value) => {
            if (value !== profile.preferredGender) {
              await updateProfile({ preferenceGender: value });
            }
            sheetRef.current?.close();
          }}
        />
      ),
    });
  };
  


  const handleFavoriteGames = () => {
    let value = [...(profile.favoriteGames ?? [])];
  
    openSheet({
      title: 'Favorite Games',
      content: (
        <ProfileEditArrayInput
          arrayItems={value}
          placeholder="Enter games"
          onArrayItemsChange={(v) => (value = v)}
        />
      ),
      useScrollView: false,
      onSubmit: async () => {
        if (JSON.stringify(value) !== JSON.stringify(profile.favoriteGames)) {
          await updateProfile({ favoriteGames: value });
        }
        sheetRef.current?.close();
      },
    });
  };
  

  const handleOtherGames = () => {
    let value = [...(profile.otherGames ?? [])];
  
    openSheet({
      title: 'Other Games',
      content: (
        <ProfileEditArrayInput
          arrayItems={value}
          placeholder="Enter games"
          onArrayItemsChange={(v) => (value = v)}
        />
      ),
      useScrollView: false,
      onSubmit: async () => {
        if (JSON.stringify(value) !== JSON.stringify(profile.otherGames)) {
          await updateProfile({ otherGames: value });
        }
        sheetRef.current?.close();
      },
    });
  };

  // Show loading while profile is being fetched
  if (loading) {
    return (
      <View style={[styles.appContainer, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#888' }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.appContainer, { backgroundColor }]}>
      <View style={styles.profileContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <ProfileBar avatarUrl={profile?.avatarUrl || ''} name={profile?.userName || ''} email={user?.email || ''} onAvatarPress={handlePhotoSource} onEditPress={handleNameEdit} />
          <ProfileMenuItem title="Bio" iconName="user" isPressed={isBioPressed} onPress={handleBio} />

          <ProfileAnimatedSubmenu isExpanded={isBioPressed}>
            <ProfileSubmenuItem title='Favorite Category' contents={[profile?.favoriteCategory || '']} onPress={handleFavoriteCategory} />
            <ProfileSubmenuItem title='Languages' contents={(profile?.languages || []).map((code: string) => reverseLanguageMapEn[code]).filter(Boolean)} onPress={handleLanguages} />
            <ProfileSubmenuItem title='Age' contents={[(profile?.age !== null && profile?.age !== undefined) ? profile.age.toString() : '']} onPress={handleAge} />
            <ProfileSubmenuItem title='Gender' contents={[profile?.gender || '']} onPress={handleGender} />
            <ProfileSubmenuItem title='Description' contents={[profile?.description || '']} onPress={handleDescription} />
          </ProfileAnimatedSubmenu>

          <ProfileMenuItem title="Preferences" iconName="thumbs-up" isPressed={isPreferencesPressed} onPress={handlePreferences} />

          <ProfileAnimatedSubmenu isExpanded={isPreferencesPressed}>
            <ProfileSubmenuItem title='Categories' contents={profile?.preferredCategories || []} onPress={handlePreferredCategories} />
            <ProfileSubmenuItem title='Languages' contents={(profile?.preferredLanguages || []).map((code: string) => reverseLanguageMapEn[code]).filter(Boolean)} onPress={handlePreferredLanguages} />
            <ProfileSubmenuItem title='Min Age' contents={[
              (() => {
                const min = profile?.preferredAgeRange instanceof Map
                  ? profile.preferredAgeRange.get('min')
                  : undefined;
                return min !== undefined && min !== null ? min.toString() : '';
              })()]}
              onPress={handlePreferredAgeRangeMin}
            />
            <ProfileSubmenuItem title='Max Age' contents={[
              (() => {
                const max = profile?.preferredAgeRange instanceof Map
                  ? profile.preferredAgeRange.get('max')
                  : undefined;
                return max !== undefined && max !== null ? max.toString() : '';
              })()]}
              onPress={handlePreferredAgeRangeMax}
            />
            <ProfileSubmenuItem title='Gender' contents={[profile?.preferredGender || '']} onPress={handlePreferredGender} />
          </ProfileAnimatedSubmenu>

          <ProfileMenuItem title="Games" iconName="game-controller-outline" isPressed={isGamesPressed} onPress={handleGames} />

          <ProfileAnimatedSubmenu isExpanded={isGamesPressed}>
            <ProfileSubmenuItem title='Favorite Games' contents={profile?.favoriteGames || []} onPress={handleFavoriteGames} />
            <ProfileSubmenuItem title='Other Games' contents={profile?.otherGames || []} onPress={handleOtherGames} />
          </ProfileAnimatedSubmenu>
          <ProfileMenuItem title="Settings" iconName="settings" isPressed={isSettingsPressed} onPress={handleSettings} />
        </ScrollView>
        <View style={styles.buttonContainer}>
          <SignOutButton label="Sign Out" onPress={handleSignOut} style={styles.signOutButton} />
        </View>
      </View>
      <ProfileEditBottomSheet ref={sheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 68,
  },
  buttonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signOutButton: {
    marginBottom: 10,
  }
})
