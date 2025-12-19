import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface Props {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}

const ProfileEditMultiSelector: React.FC<Props> = ({
  options,
  selected,
  onChange,
}) => {
  const [current, setCurrent] = useState(selected);

  const card = useThemeColor({}, 'secondaryBackground');
  const border = useThemeColor({}, 'separator');
  const text = useThemeColor({}, 'text');
  const secondary = useThemeColor({}, 'secondaryText');

  useEffect(() => {
    onChange(current);
  }, [current]);

  const toggle = (value: string) => {
    setCurrent(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <View style={styles.container}>
      {options.map(option => {
        const isSelected = current.includes(option);

        return (
          <TouchableOpacity
            key={option}
            onPress={() => toggle(option)}
            style={[
              styles.chip,
              {
                backgroundColor: card,
                borderColor: isSelected ? text : border,
              },
            ]}
          >
            <Text
              style={{
                color: isSelected ? text : secondary,
                fontWeight: isSelected ? '600' : '400',
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
});

export default ProfileEditMultiSelector;
