import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ProfileCheckModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileCheckModal({ visible, onClose }: ProfileCheckModalProps) {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackground = useThemeColor({}, 'secondaryBackground');
  const textColor = useThemeColor({}, 'text');

  const handleCompleteProfile = () => {
    onClose();
    router.push('/profile');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay]}>
        <View style={[styles.modalContent, { backgroundColor: secondaryBackground }]}>
          <Text style={[styles.title, { color: textColor }]}>Profile Incomplete</Text>
          <Text style={[styles.message, { color: textColor }]}>
            Please complete your profile to start matching with others!
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleCompleteProfile}
          >
            <Text style={styles.buttonText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#A100FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
}); 