import React from "react";
import { Alert } from "react-native";
import { MaterialIcons, AntDesign, FontAwesome } from "@expo/vector-icons";

import Button from "@/components/button/Button";
import { useTranslation } from "react-i18next";

interface AuthButtonProps {
  /**
   * Function to call when the button is pressed
   */
  onPress: () => void;
  text?: string;
  disabled?: boolean;
}

export const AppleButton: React.FC<AuthButtonProps> = ({ onPress }) => {
    const { t } = useTranslation();
    const t_apple = t("sign-in-page.apple");
  
    return (
      <Button
        text={t_apple}
        onPress={onPress || (() => Alert.alert("Continue with Apple pressed"))}
        variant="primary"
        IconLeft={({ size, color, style }) => (
          <FontAwesome name="apple" size={size} color={color} style={style} />
        )}
      />
    );
  };