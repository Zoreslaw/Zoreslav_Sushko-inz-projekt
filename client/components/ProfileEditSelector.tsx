import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Divider } from './ui/Divider';

interface ProfileEditSelectorProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}

const ProfileEditSelector: React.FC<ProfileEditSelectorProps> = ({
  options,
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      {options.map((field) => (
        <TouchableOpacity
        key={field}
        style={[
          styles.option,
          selected === field && styles.selectedOption,
        ]}
        onPress={() => onSelect(field)}
        >
          <Divider />
          <Text
          style={[
            styles.optionText,
            selected === field && styles.selectedText,
          ]}
          >
            {field}
          </Text>
          <Divider />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOption: {
    backgroundColor: '#757575',
  },
  optionText: {
    fontFamily: 'Roboto',
    fontWeight: 400,
    fontSize: 20,
    color: '#FFF',
    minHeight: 30,
    alignItems: 'center',
  },
  selectedText: {
    fontWeight: 'bold',
  },
});

export default ProfileEditSelector;