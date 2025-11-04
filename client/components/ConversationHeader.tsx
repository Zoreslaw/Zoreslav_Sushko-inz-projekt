import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Divider } from '@/components/ui/Divider';
import  useAppTheme, { APP_THEMES }  from '@/hooks/useAppTheme';


interface ConversationHeaderProps {
  title: string;
  onBackPress?: () => void;
}

export default function ConversationHeader({ title, onBackPress }: ConversationHeaderProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackgroundColor = useThemeColor({}, 'secondaryBackground');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'secondaryText');

  const { theme, setTheme } = useAppTheme();

  return (
    <View style={{ backgroundColor: backgroundColor }}>
        <View style={[styles.headerContainer, { backgroundColor: backgroundColor }]}>
            <View style={styles.leftContainer}>
                <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
                    <Ionicons name="chevron-back" size={24} color={secondaryTextColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{title}</Text>
            </View>
            <View style={styles.rightIcons}>
                <TouchableOpacity style={styles.iconCircle} onPress={() => {}}>
                <Ionicons name="notifications-outline" size={22} color={secondaryTextColor} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircle} onPress={() => {
                  setTheme(theme === APP_THEMES.LIGHT ? APP_THEMES.DARK : APP_THEMES.LIGHT);
                }}>
                <Ionicons name="moon-outline" size={22} color={secondaryTextColor} />
                </TouchableOpacity>
            </View>
        </View>
        <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 95,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Roboto',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 38,
    color: '#FFFFFF',
    maxWidth: '55%',
    marginRight: 12,
  },
  rightIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
