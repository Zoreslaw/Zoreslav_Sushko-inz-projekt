import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useNavigation } from "expo-router";

import { useThemeColor } from "@/hooks/useThemeColor";
import TeamUpLogo from "@/components/svgs/TeamUpLogo";
import { BackButton } from "@/components/button/BackButton";

interface AuthHeaderProps {
  /**
   * Optional style overrides for the container
   */
  containerStyle?: ViewStyle;
  /**
   * Optional style overrides for the logo container
   */
  logoContainerStyle?: ViewStyle;
  /**
   * Optional style overrides for the title text
   */
  titleStyle?: TextStyle;
  /**
   * Optional color override for the SVG logo
   */
  logoColor?: string;
  /**
   * Whether to show the logo or not
   */
  showLogo?: boolean;
}

/**
 * AuthHeader component for authentication screens
 *
 * This component displays the AVA logo and a title underneath.
 * It's designed to be used at the top of authentication screens.
 *
 * @param {AuthHeaderProps} props - The props for the AuthHeader component
 * @returns {React.ReactElement} The rendered AuthHeader component
 */
export const AuthHeader: React.FC<AuthHeaderProps> = ({
  containerStyle,
  showLogo = true,
}) => {
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();

  return (
    <View style={[styles.container, containerStyle]}>
        {canGoBack && <BackButton />}
        {showLogo && <TeamUpLogo />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    paddingTop: "25%",
  },
});

export default AuthHeader;
