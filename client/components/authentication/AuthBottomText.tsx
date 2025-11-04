import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

/**
 * Props for the AuthBottomText component
 */
interface AuthBottomTextProps {
  /**
   * The content to be displayed within the bottom text area.
   */
  children: React.ReactNode;

  /**
   * Optional styles to override the default container styles.
   */
  containerStyle?: ViewStyle;

  /**
   * Optional styles to override the default text styles.
   */
  textStyle?: TextStyle;
}

/**
 * AuthBottomText Component
 *
 * This component is designed to display text at the bottom of authentication screens.
 * It's typically used for displaying terms of service agreements, links to sign up or sign in,
 * or other relevant information at the bottom of the screen.
 *
 * The component uses the app's theme for text color and allows for style customization
 * through props.
 *
 * @example
 * <AuthBottomText>
 *   By continuing, you agree to our <Link to="/terms">Terms of Service</Link>
 * </AuthBottomText>
 *
 * @param {AuthBottomTextProps} props - The props for the AuthBottomText component
 * @returns {React.ReactElement} The rendered AuthBottomText component
 */
export const AuthBottomText: React.FC<AuthBottomTextProps> = ({
  children,
  containerStyle,
  textStyle,
}) => {
  const textColor = useThemeColor({}, "secondaryText");

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.text, { color: textColor }, textStyle]}>
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    lineHeight: 19.5,
    textAlign: "center",
  },
});

export default AuthBottomText;
