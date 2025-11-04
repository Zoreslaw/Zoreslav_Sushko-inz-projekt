import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps {
  /**
   * The text to display on the button
   */
  text: string;
  /**
   * Function to call when the button is pressed
   */
  onPress: () => void;
  /**
   * The visual variant of the button
   */
  variant: ButtonVariant;
  /**
   * Optional icon component to display on the left side of the button
   */
  IconLeft?: React.ComponentType<{
    size: number;
    color: string;
    style: ViewStyle;
  }>;
  /**
   * Optional style overrides for the button container
   */
  style?: ViewStyle;
  /**
   * Optional style makes button container inactive
   */
  disabled?: boolean;
}

/**
 * Button component for consistent button styling across the app
 *
 * This component renders a customizable button with an optional left icon and text.
 * It adapts to the current theme and supports primary and secondary variants.
 *
 * @param {ButtonProps} props - The props for the Button component
 * @returns {React.ReactElement} The rendered Button component
 */
export const Button: React.FC<ButtonProps> = ({
  text,
  onPress,
  variant,
  IconLeft,
  style,
  disabled,
}) => {
  const backgroundColor = useThemeColor(
    {},
    variant === "primary" ? "background" : "secondaryBackground",
  );
  const textColor = useThemeColor({}, "text");
  const disabledColor = "#cccccc";
  const disabledTextColor = "white";
  const separatorColor = useThemeColor({}, "separator");

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: disabled ? disabledColor : backgroundColor,
          borderColor: separatorColor,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {IconLeft && (
        <IconLeft
          size={24}
          color={disabled ? disabledColor : textColor}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          { color: disabled ? disabledTextColor : textColor },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    paddingHorizontal: 66,
    borderRadius: 100,
    borderWidth: 1,
  },
  icon: {
    position: "absolute",
    left: 20,
  },
  text: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Roboto_500Medium",
    fontSize: 15,
    fontWeight: "500",
  },
});

export default Button;
