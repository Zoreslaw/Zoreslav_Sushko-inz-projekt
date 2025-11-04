import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native'
import DefaultAvatarIcon from './svgs/DefaultAvatarIcon';
import { Divider } from '@/components/ui/Divider';
import { Feather } from '@expo/vector-icons';

import { useThemeColor } from '@/hooks/useThemeColor';

interface ProfileBarProps {
  avatarUrl: string;
  name: string;
  email?: string | null;
  onAvatarPress: () => void;
  onEditPress: () => void;
}

const ProfileBar: React.FC<ProfileBarProps> = ({
  avatarUrl,
  name,
  email,
  onAvatarPress,
  onEditPress,
  }) => {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <View>
      <View style={[styles.profileBarContainer, { backgroundColor }]}>
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <DefaultAvatarIcon
              width={60}
              height={60}
            />
          )}
        </TouchableOpacity>
        <View style={styles.profileTextContainer}>
          {name ? <Text style={styles.name}>{name}</Text> : ''}
          {email ? <Text style={styles.email}>{email}</Text> : ''}
        </View>
        <TouchableOpacity onPress={onEditPress} style={styles.editIcon}>
          <Feather name="edit" size={24} color="#757575"/>
        </TouchableOpacity>
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  profileBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 85,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  editIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});

export default ProfileBar;