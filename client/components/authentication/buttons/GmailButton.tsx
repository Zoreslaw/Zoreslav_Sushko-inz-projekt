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

/**
 * GmailButton component for continuing with Gmail
 *
 * @param {AuthButtonProps} props - onPress to handle click
 * @returns {React.ReactElement} The rendered GmailButton component
 */
export const GmailButton: React.FC<AuthButtonProps> = ({ onPress }) => {
    const { t } = useTranslation();
    const t_gmail = t("sign-in-page.gmail");
  
    return (
      <Button
        text={t_gmail}
        onPress={onPress}
        variant="secondary"
        IconLeft={({ size, color, style }) => (
          <AntDesign name="google" size={size} color={color} style={style} />
        )}
      />
    );
  };