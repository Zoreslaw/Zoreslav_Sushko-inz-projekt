import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Divider } from './ui/Divider';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

export interface Item {
  key: string;
  text: string;
}

interface ProfileEditArrayItemProps {
  item: Item,
  onDelete: () => void;
  drag: () => void;
}

const ProfileEditArrayItem: React.FC<ProfileEditArrayItemProps> = ({
  item,
  onDelete,
  drag,
}) => {

  return (
    <ScaleDecorator>
      <Divider />
      <View style={styles.itemContainer} >
        <TouchableOpacity style={styles.textContainer}>
          <Text style={styles.itemText}>{item.text}</Text>
        </TouchableOpacity>
        <Pressable onPress={onDelete} style={styles.trashIconContainer} >
          {({ pressed }) => (
            <Ionicons name='trash-outline' size={20} color={pressed ? 'red' : '#757575'} style={styles.trashIcon} />
          )}
        </Pressable>
      </View>
      <Divider />
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 21,
    width: '100%',
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  leftIconContainer: {

  },
  textContainer: {
    flex: 1,
  },
  itemText: {
    fontFamily: 'Roboto',
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  trashIconContainer: {

  },
  trashIcon: {

  },
})

export default ProfileEditArrayItem