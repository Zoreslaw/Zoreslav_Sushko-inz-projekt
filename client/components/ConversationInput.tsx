import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Divider } from '@/components/ui/Divider';
import { useThemeColor } from '@/hooks/useThemeColor';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';

interface ConversationInputProps {
  onSend?: (text: string, messageType?: string, url?: string) => void;
}

export default function ConversationInput({ onSend }: ConversationInputProps) {
  const colorScheme = useColorScheme();
  const [inputValue, setInputValue] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [showBlur, setShowBlur] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackgroundColor = useThemeColor({}, 'secondaryBackground');
  const secondaryTextColor = useThemeColor({}, 'secondaryText');
  const textColor = useThemeColor({}, 'text');

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setInputValue('');
  }, [inputValue, onSend]);

  const handleAttachPress = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to share images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) return;

      const image = result.assets[0];
      if (!image?.uri) return;

      setIsUploading(true);
      const upload = await api.uploadMessageMedia(image.uri);
      onSend?.('', 'Image', upload.url);
    } catch (error) {
      console.error('Media upload failed:', error);
      Alert.alert('Upload failed', 'Unable to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [onSend]);

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const { contentSize } = e.nativeEvent;
      const newHeight = Math.min(Math.max(contentSize.height, 40), 120);
      setInputHeight(newHeight);
      setShowBlur(newHeight >= 120);
    },
    []
  );

  const blurTint = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <View>
      <Divider />
      <View style={[styles.container, { backgroundColor }]}>
        <TouchableOpacity style={styles.iconContainer} onPress={handleAttachPress} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#ADB5BD" />
          ) : (
            <Ionicons name="attach" size={24} color="#ADB5BD" />
          )}
        </TouchableOpacity>

        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: secondaryBackgroundColor },
          ]}
        >
          {showBlur && (
            <BlurView
              tint={blurTint}
              intensity={30}
              style={styles.blurView}
            />
          )}
          <TextInput
            style={[
              styles.textInput,
              {
                color: textColor,
                height: inputHeight,
                minHeight: 40,
                maxHeight: 120,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={secondaryTextColor}
            value={inputValue}
            onChangeText={setInputValue}
            multiline={true}
            blurOnSubmit={false}
            returnKeyType="default"
            onContentSizeChange={handleContentSizeChange}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity style={styles.iconContainer} onPress={handleSend}>
          <Ionicons name="arrow-up-circle" size={28} color="rgba(85,0,255,0.8)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  textInput: {
    fontFamily: 'Montserrat',
    fontSize: 14,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  blurView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 1,
  },
});
