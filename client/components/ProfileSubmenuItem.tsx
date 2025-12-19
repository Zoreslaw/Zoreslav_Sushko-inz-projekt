import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ProfileSubmenuItemProps {
  title: string;
  contents: string[];
  onPress: () => void;
}

const ProfileSubmenuItem: React.FC<ProfileSubmenuItemProps> = ({
  title,
  contents,
  onPress,
}) => {
  const background = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'separator');
  const textPrimary = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'secondaryText');

  const preview =
    contents.filter(Boolean).join(', ') || 'Not set';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: background,
            borderColor: border,
          },
        ]}
      >
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: textPrimary }]}>
            {title}
          </Text>

          <Text
            style={[styles.preview, { color: textSecondary }]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: textSecondary }]}>
          ›
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  preview: {
    fontSize: 13,
  },
  chevron: {
    fontSize: 20,
    marginLeft: 8,
  },
});

export default ProfileSubmenuItem;
