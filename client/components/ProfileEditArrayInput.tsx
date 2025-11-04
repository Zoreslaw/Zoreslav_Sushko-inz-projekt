import React, { useState, useRef, useCallback } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import ProfileEditInput from './ProfileEditInput';
import ProfileEditArrayItem, { Item } from './ProfileEditArrayItem'
import { Divider } from './ui/Divider';
import { Ionicons } from '@expo/vector-icons';

interface ProfileEditArrayInputProps {
  placeholder: string;
  arrayItems?: string[];
  onArrayItemsChange: (newArray: string[]) => void;
}

const ProfileEditArrayInput: React.FC<ProfileEditArrayInputProps> = ({
  placeholder,
  arrayItems = [],
  onArrayItemsChange,
}) => {
  const [newItemText, setNewItemText] = useState('');
  const initialData: Item[] = arrayItems.map((item, index) => ({ key: `${index}`, text: item }));
  const [data, setData] = useState<Item[]>(initialData);
  const [nextKey, setNextKey] = useState<number>(initialData.length);

  const addItem = useCallback(() => {
    const trimmedText = newItemText.trim().replace(/\s+/g, ' ');
    
    if (!trimmedText) return;

    const isDuplicate = data.some(item => item.text.toLowerCase() === trimmedText.toLowerCase());
    if (isDuplicate) return;

    const newItem: Item = { key: nextKey.toString(), text: trimmedText };
    const newData = [...data, newItem];
    setData(newData);
    setNewItemText('');
    onArrayItemsChange(newData.map(item => item.text));
    setNextKey(nextKey + 1);
  }, [newItemText, data, nextKey, onArrayItemsChange]);

  const deleteItem = useCallback((key: string) => {
    const newData = data.filter(item => item.key !== key);
    setData(newData);
    onArrayItemsChange(newData.map(item => item.text));
  }, [data, onArrayItemsChange]);

  const renderItem = useCallback((params: RenderItemParams<Item>) => {
    const { item, drag, isActive } = params;
    return (
      <ProfileEditArrayItem
        item={item}
        onDelete={() => deleteItem(item.key)}
        drag={drag}
      />
    );
  }, [deleteItem]);

  const handleDragEnd = useCallback(({ data: newData }: { data: Item[] }) => {
    setData(newData);
    onArrayItemsChange(newData.map((item: Item) => item.text));
  }, [onArrayItemsChange]);

  return (
    <View style={styles.componentContainer}>
      <View style={styles.inputArea}>
        <ProfileEditInput placeholder={placeholder} value={newItemText} onChangeText={setNewItemText} />
        <TouchableOpacity onPress={addItem} style={styles.iconContainer} >
          <Ionicons name='add-circle-outline' size={28} color='#757575' style={styles.addIcon} />
        </TouchableOpacity>
      </View>
      <Divider />
      <View style={styles.itemsList}>
        <DraggableFlatList
          keyExtractor={(item) => item.key}
          data={data}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          activationDistance={20}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  componentContainer: {
    flexShrink: 1,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  iconContainer: {
    marginRight: 10,
  },
  addIcon: {
    justifyContent: 'center',
  },
  itemsList: {
    flexGrow: 1,
    flexShrink: 1,
  }
});

export default ProfileEditArrayInput;