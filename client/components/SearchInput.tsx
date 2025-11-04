import { View, TextInput, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import SearchIcon from './svgs/SearchIcon';

interface SearchInputProps {
  placeholder: string;
  onChangeText: (text: string) => void;
  value: string;
}

export default function SearchInput({ placeholder, onChangeText, value }: SearchInputProps) {

    const backgroundColor = useThemeColor({}, "background");
    const textColor = useThemeColor({}, "text");
    const secondaryTextColor = useThemeColor({}, "secondaryText");
    const secondaryBackground = useThemeColor({}, "secondaryBackground");

  return (
    <View style={[styles.container, { backgroundColor: secondaryBackground }]}>
      <SearchIcon style={styles.icon} />
      <TextInput 
        style={[styles.input, { color: textColor }]} 
        placeholder={placeholder} 
        onChangeText={onChangeText} 
        value={value}
        placeholderTextColor={secondaryTextColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    height: 50,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
});

