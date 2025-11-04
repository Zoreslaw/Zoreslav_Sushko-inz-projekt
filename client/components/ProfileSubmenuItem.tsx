import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ProfileSubmenuItemProps {
  title: string;
  contents: string[];
  onPress: () => void;
}

const ProfileSubmenuItem: React.FC<ProfileSubmenuItemProps> = ({
  title,
  contents,
  onPress,
}) => {
  return(
    <View style={styles.itemContainer}>
      <Text style={styles.titleText}>{title}</Text>
      <TouchableOpacity onPress={onPress} style={styles.contentsContainer}>
        {contents.map((text, index) => (
          <Text key={index} style={styles.contentsText}>
            {text}
          </Text>
        ))}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    marginTop: 10,
    marginBottom: 10,
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  titleText: {
    fontFamily: 'Roboto',
    fontSize: 15,
    fontWeight: 400,
    color: '#FFFFFF',
    marginLeft: 10,
  },
  contentsContainer: {
    minHeight: 50,
    justifyContent: 'center',
    backgroundColor: '#242424',
    borderColor: '#757575',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  contentsText: {
    fontFamily: 'Roboto',
    fontSize: 20,
    fontWeight: 400,
    color: '#FFFFFF',
    paddingVertical: 0,
  }
})

export default ProfileSubmenuItem;