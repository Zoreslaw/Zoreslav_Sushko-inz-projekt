import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage'
import { useRouter } from 'expo-router';
import { SignOutButton } from '@/components/button/SignOutButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, UserProfileUpdate } from '@/hooks/useProfile';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileBar from '@/components/ProfileBar';
import ProfileMenuItem from '@/components/ProfileMenuItem';
import ProfileSubmenuItem from '@/components/ProfileSubmenuItem';
import ProfileEditModal from '@/components/ProfileEditModal';
import ProfileAnimatedSubmenu from '@/components/ProfileAnimatedSubmenu';
import ProfileEditInput from '@/components/ProfileEditInput';
import ProfileEditArrayInput from '@/components/ProfileEditArrayInput';
import ProfileEditSelector from '@/components/ProfileEditSelector';
import ProfileEditMultiSelector from '@/components/ProfileEditMultiSelector';
import languageMapEn, { reverseLanguageMapEn } from '@/localization/languageMaps';

interface ModalData {
  title: string;
  key?:
  'userNameEdit' |
  'favCatEdit' |
  'langEdit' |
  'ageEdit' |
  'genderEdit' |
  'descEdit' |
  'prefCatEdit' |
  'prefLangEdit' |
  'prefAgeRangeMinEdit' |
  'prefAgeRangeMaxEdit' |
  'favGamesEdit' |
  'otherGamesEdit' |
  'other' |
  string;
  content?: JSX.Element;
  isSelector?: boolean;
  isSubmit?: boolean;
}

export default function Profile() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const [isBioPressed, setIsBioPressed] = useState(false);
  const [isPreferencesPressed, setIsPreferencesPressed] = useState(false);
  const [isGamesPressed, setIsGamesPressed] = useState(false);
  const [isSettingsPressed, setIsSettingsgPressed] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [updateUserProfilePayload, setUpdateUserProfilePayload] = useState<UserProfileUpdate | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  const handlePhotoSource = async () => {
    setModalData({
      title: "Profile Photo",
      content: (
        <ProfileEditSelector
          options={['Camera', 'Gallery', 'Cancel']}
          selected={'Cancel'}
          onSelect={(source) => { handleAvatarEdit(source) }}
        />
      ),
      isSelector: true,
      isSubmit: false,
    });

    setIsModalVisible(true);
  }

  const handleAvatarEdit = async (source: string) => {
    try {
      if (!user) {
        Alert.alert("User must be authenticated to update avatars.");
        return;
      }

      var result;

      switch (source) {
        case 'Camera': {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          break;
        }

        case 'Gallery': {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          break;
        }

        default:
          handleCloseModal();
          return;
      };

      if (result.canceled) return;

      handleCloseModal();

      const image = result.assets[0];
      const response = await fetch(image.uri);
      const blob = await response.blob();

      const fileName = `avatars/${user.uid}/avatar_${Date.now()}.jpg`;
      const reference = storage().ref(fileName);
      await reference.put(blob);

      const downloadUrl = await reference.getDownloadURL();
      await updateProfile({ photoURL: downloadUrl });

    } catch (err) {
      console.error("Avatar upload failed:", err);
      Alert.alert("Upload Error", "Could not update your avatar.");
    }
  }

  const handleNameEdit = async () => {
    setModalData({
      title: "User Name",
      key: "userNameEdit",
      content: <ProfileEditInput
        value={updateUserProfilePayload?.displayName}
        onChangeText={(newText) => {
          setUpdateUserProfilePayload(
            prev => ({
              ...(prev ?? {}),
              displayName: newText
            }));
        }}
        placeholder='Enter new user name'
      />
    });
    setIsModalVisible(true);
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

  const handleFavoriteCategory = async () => {
    setModalData({
      title: "Favorite Category",
      key: "favCatEdit",
      content: <ProfileEditInput
        value={updateUserProfilePayload?.favoriteCategory}
        onChangeText={(newText) => {
          setUpdateUserProfilePayload(
            prev => ({
              ...(prev ?? {}),
              favoriteCategory: newText
            }));
        }}
        placeholder="Enter favorite category"
      />
    });
    setIsModalVisible(true);
  }

  const handleLanguages = async () => {
    const currentCodes = profile.languages ?? [];
    const currentNames = currentCodes
      .map(code => reverseLanguageMapEn[code])
      .filter(Boolean);
  
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      languages: currentNames,
    }));
  
    setModalData({
      title: "Languages",
      key: "langEdit",
      content: (
        <ProfileEditMultiSelector
          options={Object.keys(languageMapEn)}
          selected={currentNames}
          onChange={(newSelected) => {
            setUpdateUserProfilePayload(prev => ({
              ...(prev ?? {}),
              languages: newSelected,
            }));
          }}
        />
      ),
      isSelector: true,
    });
  
    setIsModalVisible(true);
  };

  const handleAge = async () => {
    setModalData({
      title: "Age",
      key: "ageEdit",
      content: <ProfileEditInput
        value={updateUserProfilePayload?.age}
        onChangeText={(newText) => {
          setUpdateUserProfilePayload(
            prev => ({
              ...(prev ?? {}),
              age: newText.replace(/[^0-9]/g, '').replace(/^0+/, '')
            }));
        }}
        placeholder="Enter age"
        isNumeric={true}
      />
    });
    setIsModalVisible(true);
  }

  const handleGender = async () => {
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      gender: profile.gender
    }));

    setModalData({
      title: "Gender",
      content: (
        <ProfileEditSelector
          options={['Male', 'Female', 'Other']}
          selected={profile.preferredGender}
          onSelect={(value) => { handleSelector("genderEdit", value) }}
        />
      ),
      isSelector: true,
      isSubmit: false,
    });

    setIsModalVisible(true);
  }

  const handleDescription = async () => {
    const initialDescription = profile.description ?? '';
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      description: initialDescription
    }));

    setTimeout(() => {
      setModalData({
        title: "Description",
        key: "descEdit",
        content: <ProfileEditInput
          value={initialDescription}
          onChangeText={(newText) => {
            setUpdateUserProfilePayload(
              prev => ({
                ...(prev ?? {}),
                description: newText
              }));
          }}
          placeholder="Enter description"
          multiline={true}
        />
      });
      setIsModalVisible(true);
    }, 0);
  }

  const handlePreferredCategories = async () => {
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      preferenceCategories: profile.preferredCategories ?? []
    }));

    setTimeout(() => {
      setModalData({
        title: "Preferred Categories",
        key: "prefCatEdit",
        content: <ProfileEditArrayInput
          arrayItems={profile.preferredCategories ?? []}
          onArrayItemsChange={(newArray) => {
            setUpdateUserProfilePayload(prev => ({
              ...(prev ?? {}),
              preferenceCategories: newArray
            }));
          }}
          placeholder="Enter categories"
        />
      });
      setIsModalVisible(true);
    }, 0);
  }

  const handlePreferredLanguages = async () => {
    const currentCodes = profile.preferredLanguages ?? [];
    const currentNames = currentCodes
      .map(code => reverseLanguageMapEn[code])
      .filter(Boolean);

    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      preferenceLanguages: currentNames,
    }));

    setModalData({
      title: "Preferred Languages",
      key: "prefLangEdit",
      content: (
        <ProfileEditMultiSelector
          options={Object.keys(languageMapEn)}
          selected={currentNames}
          onChange={(newSelected) => {
            setUpdateUserProfilePayload(prev => ({
              ...(prev ?? {}),
              preferenceLanguages: newSelected,
            }));
          }}
        />
      ),
      isSelector: true,
    });

    setIsModalVisible(true);
  };

  const handlePreferredAgeRangeMin = async () => {
    setModalData({
      title: "Preferred Min Age",
      key: "prefAgeRangeMinEdit",
      content: <ProfileEditInput
        onChangeText={(newText) => {
          const parsed = parseInt(newText.replace(/[^0-9]/g, '').replace(/^0+/, ''), 10);
          setUpdateUserProfilePayload(prev => {
            const currentRange = new Map(profile.preferredAgeRange);
            currentRange.set('min', isNaN(parsed) ? 0 : parsed);
            return {
              ...(prev ?? {}),
              preferenceAgeRange: currentRange
            };
          });
        }}
        placeholder="Enter min age"
        isNumeric={true}
      />
    });

    setIsModalVisible(true);
  }

  const handlePreferredAgeRangeMax = async () => {

    setModalData({
      title: "Preferred Max Age",
      key: "prefAgeRangeMaxEdit",
      content: <ProfileEditInput
        onChangeText={(newText) => {
          const parsed = parseInt(newText.replace(/[^0-9]/g, '').replace(/^0+/, ''), 10);
          setUpdateUserProfilePayload(prev => {
            const currentRange = new Map(profile.preferredAgeRange);
            currentRange.set('max', isNaN(parsed) ? 0 : parsed);
            return {
              ...(prev ?? {}),
              preferenceAgeRange: currentRange
            };
          });
        }}
        placeholder="Enter max age"
        isNumeric={true}
      />
    });

    setIsModalVisible(true);
  }

  const handlePreferredGender = async () => {
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      preferenceGender: profile.preferredGender
    }));

    setModalData({
      title: "Preferred Gender",
      content: (
        <ProfileEditSelector
          options={['Any', 'Male', 'Female', 'Other']}
          selected={profile.preferredGender}
          onSelect={(value) => { handleSelector("prefGenderEdit", value) }}
        />
      ),
      isSelector: true,
      isSubmit: false,
    });

    setIsModalVisible(true);
  };


  const handleFavoriteGames = async () => {
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      favoriteGames: profile.favoriteGames ?? []
    }));

    setTimeout(() => {
      setModalData({
        title: "Favorite Games",
        key: "favGamesEdit",
        content: <ProfileEditArrayInput
          arrayItems={profile.favoriteGames ?? []}
          onArrayItemsChange={(newArray) => {
            setUpdateUserProfilePayload(prev => ({
              ...(prev ?? {}),
              favoriteGames: newArray
            }));
          }}
          placeholder="Enter games"
        />
      });
      setIsModalVisible(true);
    }, 0);
  }

  const handleOtherGames = async () => {
    setUpdateUserProfilePayload(prev => ({
      ...(prev ?? {}),
      otherGames: profile.otherGames ?? []
    }));

    setTimeout(() => {
      setModalData({
        title: "Other Games",
        key: "otherGamesEdit",
        content: <ProfileEditArrayInput
          arrayItems={profile.otherGames ?? []}
          onArrayItemsChange={(newArray) => {
            setUpdateUserProfilePayload(prev => ({
              ...(prev ?? {}),
              otherGames: newArray
            }));
          }}
          placeholder="Enter games"
        />
      });
      setIsModalVisible(true);
    }, 0);
  }

  const handleCloseModal = async () => {
    setIsModalVisible(false);
    setModalData(null);
    setUpdateUserProfilePayload(null);
  }

  const handleSubmit = async () => {
    switch (modalData?.key) {
      case 'userNameEdit': {
        const newDisplayName = updateUserProfilePayload?.displayName?.trim().replace(/\s+/g, ' ') ?? '';
        const oldDisplayName = profile.userName;

        if (newDisplayName.trim().length === 0) {
          Alert.alert("Invalid Name", "User name cannot be empty.");
          return;
        }

        if (oldDisplayName !== newDisplayName) {
          await updateProfile({ displayName: newDisplayName });
        }

        break;
      }

      case 'favCatEdit': {
        const newFavoriteCategory = updateUserProfilePayload?.favoriteCategory?.trim().replace(/\s+/g, ' ') ?? '';
        const oldFavoriteCategory = profile.favoriteCategory;

        if (oldFavoriteCategory !== '' && newFavoriteCategory.trim().length === 0) {
          await updateProfile({ favoriteCategory: '' });
          break;
        }

        if (oldFavoriteCategory !== newFavoriteCategory) {
          await updateProfile({ favoriteCategory: newFavoriteCategory });
        }

        break;
      }

      case 'langEdit': {
        const selectedLanguages = updateUserProfilePayload?.languages ?? [];
        const newLanguages = selectedLanguages
          .map(name => languageMapEn[name])
          .filter(Boolean);
        const oldLanguages = profile.languages;
      
        if (oldLanguages.length > 0 && newLanguages.length === 0) {
          await updateProfile({ languages: [] });
          break;
        }
      
        if (JSON.stringify(oldLanguages) !== JSON.stringify(newLanguages)) {
          await updateProfile({ languages: newLanguages });
        }
      
        break;
      }
      

      case 'ageEdit': {
        const newAge = updateUserProfilePayload?.age ?? '';
        const oldAge = profile?.age?.toString() ?? '';

        if (oldAge !== '' && newAge.trim().length === 0) {
          await updateProfile({ age: '' });
          break;
        }

        if (oldAge !== newAge) {
          await updateProfile({ age: newAge })
        }

        break;
      }

      case 'descEdit': {
        const newDescription = updateUserProfilePayload?.description?.trim().replace(/\s+/g, ' ') ?? '';
        const oldDescription = profile.description;

        if (oldDescription !== '' && newDescription.trim().length === 0) {
          await updateProfile({ description: '' });
          break;
        }

        if (oldDescription !== newDescription) {
          await updateProfile({ description: newDescription });
        }

        break;
      }

      case 'prefCatEdit': {
        const newPreferenceCategories = updateUserProfilePayload?.preferenceCategories ?? [];
        const oldPreferenceCategories = profile.preferredCategories;

        if (oldPreferenceCategories.length > 0 && newPreferenceCategories.length === 0) {
          await updateProfile({ preferenceCategories: [] });
          break;
        }

        if (JSON.stringify(oldPreferenceCategories) !== JSON.stringify(newPreferenceCategories)) {
          await updateProfile({ preferenceCategories: newPreferenceCategories });
        }

        break;
      }

      case 'prefLangEdit': {
        const selectedLanguages = updateUserProfilePayload?.preferenceLanguages ?? [];
        const newPreferenceLanguages = selectedLanguages
          .map(name => languageMapEn[name])
          .filter(Boolean);
        const oldPreferenceLanguages = profile.preferredLanguages;

        if (oldPreferenceLanguages.length > 0 && newPreferenceLanguages.length === 0) {
          await updateProfile({ preferenceLanguages: [] });
          break;
        }

        if (JSON.stringify(oldPreferenceLanguages) !== JSON.stringify(newPreferenceLanguages)) {
          await updateProfile({ preferenceLanguages: newPreferenceLanguages });
        }

        break;
      }

      case 'prefAgeRangeMinEdit':
      case 'prefAgeRangeMaxEdit': {
        const newRange = updateUserProfilePayload?.preferenceAgeRange;
        const oldRange = profile.preferredAgeRange;

        if (!newRange) break;

        const newMin = newRange.get('min');
        const newMax = newRange.get('max');
        const oldMin = oldRange.get('min');
        const oldMax = oldRange.get('max');

        const didMinChange = newMin !== oldMin;
        const didMaxChange = newMax !== oldMax;

        if (didMinChange || didMaxChange) {
          const updatedRange = new Map(oldRange);

          if (didMinChange && newMin !== undefined) updatedRange.set('min', newMin);
          if (didMaxChange && newMax !== undefined) updatedRange.set('max', newMax);

          await updateProfile({ preferenceAgeRange: updatedRange });
        }

        break;
      }

      case 'favGamesEdit': {
        const newFavoriteGames = updateUserProfilePayload?.favoriteGames ?? [];
        const oldFavoriteGames = profile.favoriteGames;

        if (oldFavoriteGames.length > 0 && newFavoriteGames.length === 0) {
          await updateProfile({ favoriteGames: [] });
          break;
        }

        if (JSON.stringify(oldFavoriteGames) !== JSON.stringify(newFavoriteGames)) {
          await updateProfile({ favoriteGames: newFavoriteGames });
        }

        break;
      }

      case 'otherGamesEdit': {
        const newOtherGames = updateUserProfilePayload?.otherGames ?? [];
        const oldOtherGames = profile.otherGames;

        if (oldOtherGames.length > 0 && newOtherGames.length === 0) {
          await updateProfile({ otherGames: [] });
          break;
        }

        if (JSON.stringify(oldOtherGames) !== JSON.stringify(newOtherGames)) {
          await updateProfile({ otherGames: newOtherGames });
        }

        break;
      }

      default:
        return;
    }

    await handleCloseModal();
  };

  const handleSelector = async (key: string, value: string) => {
    switch (key) {
      case 'prefGenderEdit': {
        if (!value || value === profile.preferredGender) break;

        await updateProfile({ preferenceGender: value });

        break;
      }

      case 'genderEdit': {
        if (!value || value === profile.gender) break;

        await updateProfile({ gender: value });

        break;
      }

      default:
        return;
    };

    await handleCloseModal();
  };

  return (
    <View style={[styles.appContainer, { backgroundColor }]}>
      <View style={styles.profileContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <ProfileBar avatarUrl={profile?.avatarUrl} name={profile?.userName} email={user?.email} onAvatarPress={handlePhotoSource} onEditPress={handleNameEdit} />
          <ProfileMenuItem title="Bio" iconName="user" isPressed={isBioPressed} onPress={handleBio} />

          <ProfileAnimatedSubmenu isExpanded={isBioPressed}>
            <ProfileSubmenuItem title='Favorite Category' contents={[profile?.favoriteCategory]} onPress={handleFavoriteCategory} />
            <ProfileSubmenuItem title='Languages' contents={profile?.languages.map(code => reverseLanguageMapEn[code]).filter(Boolean)} onPress={handleLanguages} />
            <ProfileSubmenuItem title='Age' contents={[(profile.age ? profile.age.toString() : '')]} onPress={handleAge} />
            <ProfileSubmenuItem title='Gender' contents={[profile?.gender]} onPress={handleGender} />
            <ProfileSubmenuItem title='Description' contents={[profile?.description]} onPress={handleDescription} />
          </ProfileAnimatedSubmenu>

          <ProfileMenuItem title="Preferences" iconName="thumbs-up" isPressed={isPreferencesPressed} onPress={handlePreferences} />

          <ProfileAnimatedSubmenu isExpanded={isPreferencesPressed}>
            <ProfileSubmenuItem title='Categories' contents={profile.preferredCategories} onPress={handlePreferredCategories} />
            <ProfileSubmenuItem title='Languages' contents={profile.preferredLanguages.map(code => reverseLanguageMapEn[code]).filter(Boolean)} onPress={handlePreferredLanguages} />
            <ProfileSubmenuItem title='Min Age' contents={[
              (() => {
                const min = profile.preferredAgeRange instanceof Map
                  ? profile.preferredAgeRange.get('min')
                  : undefined;
                return min !== undefined ? min.toString() : '';
              })()]}
              onPress={handlePreferredAgeRangeMin}
            />
            <ProfileSubmenuItem title='Max Age' contents={[
              (() => {
                const max = profile.preferredAgeRange instanceof Map
                  ? profile.preferredAgeRange.get('max')
                  : undefined;
                return max !== undefined ? max.toString() : '';
              })()]}
              onPress={handlePreferredAgeRangeMax}
            />
            <ProfileSubmenuItem title='Gender' contents={[profile.preferredGender]} onPress={handlePreferredGender} />
          </ProfileAnimatedSubmenu>

          <ProfileMenuItem title="Games" iconName="game-controller-outline" isPressed={isGamesPressed} onPress={handleGames} />

          <ProfileAnimatedSubmenu isExpanded={isGamesPressed}>
            <ProfileSubmenuItem title='Favorite Games' contents={profile.favoriteGames} onPress={handleFavoriteGames} />
            <ProfileSubmenuItem title='Other Games' contents={profile.otherGames} onPress={handleOtherGames} />
          </ProfileAnimatedSubmenu>
          <ProfileMenuItem title="Settings" iconName="settings" isPressed={isSettingsPressed} onPress={handleSettings} />
        </ScrollView>
        <View style={styles.buttonContainer}>
          <SignOutButton label="Sign Out" onPress={handleSignOut} style={styles.signOutButton} />
        </View>
      </View>
      <ProfileEditModal title={modalData?.title} isVisible={isModalVisible} closeModal={handleCloseModal} onSubmit={handleSubmit} isSelector={modalData?.isSelector} isSubmit={modalData?.isSubmit}>
        {modalData?.content}
      </ProfileEditModal>
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