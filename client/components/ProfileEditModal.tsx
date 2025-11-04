import React from 'react'
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native'
import { Divider } from './ui/Divider';
import { SubmitButton } from './button/SubmitButton';

interface ProfileEditModalProps {
  title?: string;
  isVisible: boolean;
  closeModal: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  isSelector?: boolean;
  isSubmit?: boolean;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  title,
  isVisible,
  closeModal,
  onSubmit,
  children,
  isSelector = false,
  isSubmit = true,
}) => {
  return (
    <Modal animationType='fade' transparent visible={isVisible} onRequestClose={closeModal} >
      <TouchableWithoutFeedback onPress={closeModal} >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => { }} >
            <View style={styles.modalContent} >
              <Text style={[ styles.modalTitleText, { marginTop: isSelector ? 0 : 10 } ]}>{title}</Text>
              <Divider />
              <View style={styles.modalChildrenContainer}>
                {children}
              </View>
              <Divider />
              <View style={styles.modalSubmitButtonContainer}>
                { isSubmit && <SubmitButton label='Submit' onPress={onSubmit} /> }
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  modalContent: {
    alignItems: 'center',
    width: '70%',
    maxHeight: '70%',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderColor: '#757575',
    borderWidth: 1,
    paddingVertical: 10,
    overflow: 'visible',
  },
  modalTitleText: {
    fontFamily: 'Roboto',
    fontSize: 20,
    fontWeight: 400,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  modalChildrenContainer: {
    flexShrink: 1,
    width: '100%',
    overflow: 'visible',
  },
  modalSubmitButtonContainer: {
    marginTop: 10,
    justifyContent: 'flex-end',
  },
})

export default ProfileEditModal;