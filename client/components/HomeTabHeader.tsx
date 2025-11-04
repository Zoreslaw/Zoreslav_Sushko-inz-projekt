import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from "@/hooks/useThemeColor";
import useAppTheme, { APP_THEMES } from "@/hooks/useAppTheme";

type TabHeaderProps = {
  title?: string;
}

export default function HomeTabHeader({ title = "Home" }: TabHeaderProps) {
  const secondaryTextColor = useThemeColor({}, 'secondaryText');
  const { theme, setTheme } = useAppTheme();

  return (
    <LinearGradient
      colors={['#000000', 'rgba(34, 0, 14, 0.4)', 'rgba(0, 0, 0, 0.2)', 'rgba(255, 0, 102, 0)']}
      locations={[0, 0.504, 0.689, 1]}
      style={styles.headerContainer}>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButtons}>
        <TouchableOpacity style={[styles.iconButton, {borderColor: secondaryTextColor}]} onPress={() => {}}>
          {/* Notification Icon */}
          <Ionicons name="notifications-outline" size={22} color={secondaryTextColor} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconButton, {borderColor: secondaryTextColor}]} onPress={() => {
            setTheme(theme === APP_THEMES.LIGHT ? APP_THEMES.DARK : APP_THEMES.LIGHT);
          }}>
            <Ionicons name="moon-outline" size={22} color={secondaryTextColor} />
          </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    width: '100%',
    maxHeight: 95,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 5,
  },
  headerTitle: {
    fontFamily: 'Roboto',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: 29,
    lineHeight: 38,
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4,
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
