import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Divider } from './ui/Divider';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const ProfileEditMultiSelector: React.FC<Props> = ({
  options,
  selected,
  onChange,
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selected);

  useEffect(() => {
    onChange(currentSelected);
  }, [currentSelected]);

  const toggleOption = (value: string) => {
    setCurrentSelected(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {options.map((field, index) => {
          const isSelected = currentSelected.includes(field);
          return (
            <TouchableOpacity
              key={field}
              style={[
                styles.option,
                isSelected && styles.selectedOption,
              ]}
              onPress={() => toggleOption(field)}
              activeOpacity={0.7}
            >
              <Divider />
              <Text
                style={[
                  styles.optionText,
                  isSelected ? styles.selectedText : styles.unselectedText,
                ]}
              >
                {field}
              </Text>
              <Divider />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    width: '100%',
  },
  scrollContent: {
  },
  option: {
    borderBottomColor: '#ccc',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#757575',
  },
  optionText: {
    fontFamily: 'Roboto',
    fontSize: 18,
    height: 30,
    marginVertical: 4,
  },
  selectedText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  unselectedText: {
    color: '#888',
  },
});

export default ProfileEditMultiSelector;
