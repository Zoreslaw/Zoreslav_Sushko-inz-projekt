import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Divider } from '@/components/ui/Divider';
import useAppTheme, { APP_THEMES } from '@/hooks/useAppTheme';

interface TabHeaderProps {
  title: string;
}

export default function TabHeader({ title }: TabHeaderProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackgroundColor = useThemeColor({}, 'secondaryBackground');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'secondaryText');

  const { theme, setTheme } = useAppTheme();

  return (
    <View style={{ backgroundColor: backgroundColor }}>
      <View style={[styles.headerContainer, { backgroundColor: backgroundColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{title}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.iconButton, {borderColor: secondaryTextColor}]} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={22} color={secondaryTextColor} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, {borderColor: secondaryTextColor}]} onPress={() => {
            setTheme(theme === APP_THEMES.LIGHT ? APP_THEMES.DARK : APP_THEMES.LIGHT);
          }}>
            <Ionicons name="moon-outline" size={22} color={secondaryTextColor} />
          </TouchableOpacity>
        </View>
      </View>
      <Divider />
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 95,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontFamily: 'Roboto',
    fontSize: 29,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 42,
    shadowColor: "#FFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})