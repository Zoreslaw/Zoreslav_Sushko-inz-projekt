import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';

interface ProfileEditInputProps {
  placeholder: string;
  value?: string;
  onChangeText: (text: string) => void;
  isNumeric?: boolean;
  multiline?: boolean;
}

const ProfileEditInput: React.FC<ProfileEditInputProps> = ({
  placeholder,
  value,
  onChangeText,
  isNumeric = false,
  multiline = false,
}) => {
  const [inputValue, setInputValue] = useState(value ?? '');

  useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  const handleTextChange = (text: string) => {
    setInputValue(text);
    onChangeText(text);
  };

  return (
    <View style={styles.textInputContainer}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#757575"
        style={styles.textInput}
        value={inputValue}
        onChangeText={handleTextChange}

        inputMode={isNumeric ? 'numeric' : 'text'}
        keyboardType={isNumeric ? 'numeric' : 'default'}

        multiline={multiline}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  textInputContainer: {
    minHeight: 50,
    justifyContent: 'center',
    backgroundColor: '#242424',
    borderColor: '#757575',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginBottom: 10,
    flexGrow: 1,
    flexShrink: 1,
  },
  textInput: {
    fontFamily: 'Roboto',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    paddingVertical: 5,
  },
});

export default ProfileEditInput;
