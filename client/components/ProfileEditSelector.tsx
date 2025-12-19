import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface Props {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}

const ProfileEditSelector: React.FC<Props> = ({
  options,
  selected,
  onSelect,
}) => {
  const card = useThemeColor({}, 'secondaryBackground');
  const border = useThemeColor({}, 'separator');
  const text = useThemeColor({}, 'text');
  const secondary = useThemeColor({}, 'secondaryText');

  return (
    <>
      {options.map(option => {
        const isSelected = selected === option;

        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            activeOpacity={0.85}
            style={[
              styles.option,
              {
                backgroundColor: card,
                borderColor: isSelected ? text : border,
              },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isSelected ? text : secondary },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  option: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ProfileEditSelector;
