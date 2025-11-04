import { TouchableOpacity, ViewStyle, Text, StyleSheet, StyleProp } from "react-native";
import { SvgProps } from "react-native-svg";
import HomeIcon from "../svgs/HomeIcon";
import ChatIcon from "../svgs/ChatIcon";
import ProfileIcon from "../svgs/ProfileIcon";
import { useThemeColor } from "@/hooks/useThemeColor";

interface TabBarButtonProps {
  label: string;
  onPress: () => void;
  isActive: boolean;
  tabName: string;
  currentRoute: string;
}

const getIcon = (tabName: string, isActive: boolean, currentRoute: string, style?: StyleProp<ViewStyle>) => {
    const textColor = useThemeColor({}, "text");
    const inactiveColor = isActive ? "#000000" : textColor;
    console.log(currentRoute);

  switch (tabName) {
    case 'home':
      return <HomeIcon fill={inactiveColor} style={style} />;
    case 'chat':
      return <ChatIcon stroke={currentRoute === 'home' ? '#B0B0B0' : inactiveColor} style={style} />;
    case 'profile':
      return <ProfileIcon stroke={currentRoute === 'home' ? '#B0B0B0' : inactiveColor} style={style} />;
    default:
      return <HomeIcon fill={inactiveColor} style={style} />;
  }
};

export const TabBarButton = ({ label, onPress, isActive, tabName, currentRoute }: TabBarButtonProps) => {
  return (
    <TouchableOpacity 
        onPress={onPress} 
        style={[styles.button, isActive && styles.activeButton]}
    >
        {getIcon(tabName, isActive, currentRoute, styles.icon)}
        {isActive && <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeButton: {
    backgroundColor: '#B8B8B8',
  },
  label: {
    fontFamily: 'Open Sans Hebrew',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 16,
    color: '#000000',
  },
  activeLabel: {
    color: '#000000',
  },
  activeIcon: {
    color: '#000000',
  },
});



