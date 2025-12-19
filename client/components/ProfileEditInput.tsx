import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ProfileEditInputProps {
  placeholder: string;
  value?: string;
  onChangeText: (text: string) => void;
  isNumeric?: boolean;
  multiline?: boolean;
}

const ProfileEditInput: React.FC<ProfileEditInputProps> = ({
  placeholder,
  value = '',
  onChangeText,
  isNumeric = false,
  multiline = false,
}) => {
  const background = useThemeColor({}, 'secondaryBackground');
  const border = useThemeColor({}, 'separator');
  const text = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'secondaryText');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: background,
          borderColor: border,
        },
      ]}
    >
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        style={[
          styles.input,
          { color: text },
          multiline && styles.multiline,
        ]}
        onChangeText={onChangeText}
        inputMode={isNumeric ? 'numeric' : 'text'}
        keyboardType={isNumeric ? 'numeric' : 'default'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    fontSize: 16,
    fontWeight: '400',
    minHeight: 24,
  },
  multiline: {
    minHeight: 120,
  },
});

export default ProfileEditInput;
