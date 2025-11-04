import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useNavigation, useRouter } from "expo-router";

interface BackButtonProps {
  /**
   * Optional style overrides for the button container
   */
  style?: ViewStyle;

  containerStyle?: ViewStyle;
}

/**
 * BackButton component for displaying a back arrow icon button
 *
 * This component renders a customizable icon button with a back arrow icon.
 * It adapts to the current theme and can be styled with custom properties.
 *
 * @param {BackButtonProps} props - The props for the BackButton component
 * @returns {React.ReactElement} The rendered BackButton component
 */
export const BackButton: React.FC<BackButtonProps> = ({
  style,
  containerStyle,
}) => {
  const iconColor = useThemeColor({}, "text");

  const router = useRouter();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();
  const handleGoBack = () => {
    if (canGoBack) {
      router.back();
    }
  };

  return (
    <View style={[styles.backButton, containerStyle]}>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handleGoBack}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={16} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    left: 30,
    top: 30,
    zIndex: 10,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "gray",
    alignItems: "center",
    justifyContent: "center",
  },
});
