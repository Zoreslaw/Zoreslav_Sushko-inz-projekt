import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import CheckIcon from '@/components/svgs/CheckIcon';

interface ConversationBubbleProps {
  text: string;
  isMine: boolean;
  timestamp: number;
  type?: 'Text' | 'File';
  fileName?: string;
  fileSize?: string;
  status: 'Sent' | 'Read';
}

export default function ConversationBubble({
  text,
  isMine,
  timestamp,
  type = 'Text',
  fileName,
  fileSize,
  status,
}: ConversationBubbleProps) {
  const bubbleStyle = isMine ? styles.myBubble : styles.otherBubble;

  if (type === 'File' && fileName) {
    return (
      <View style={[styles.bubbleContainer, isMine && styles.myBubbleContainer]}>
        <View style={[styles.bubble, bubbleStyle]}>
          <Text style={styles.fileName}>{fileName}</Text>
          {fileSize && <Text style={styles.fileSize}>{fileSize}</Text>}
          <TouchableOpacity style={styles.downloadButton}>
            <Text style={styles.downloadText}>Download</Text>
          </TouchableOpacity>

          {isMine && (
            <CheckIcon
              style={styles.statusIcon}
              fill={status === 'Read' ? '#7B00FF' : '#999999'}
              width={14}
              height={12}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleContainer, isMine && styles.myBubbleContainer]}>
      <View style={[styles.bubble, bubbleStyle]}>
        <Text style={[styles.messageText, isMine ? { color: '#F7F7F7' } : { color: '#272727' }]}>
          {text}
        </Text>

        {isMine && (
          <CheckIcon
            style={styles.statusIcon}
            fill={status === 'Read' ? 'rgb(85, 0, 255)' : '#F7F7F7'}
            width={14}
            height={12}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    marginVertical: 2,
    alignItems: 'flex-start',
  },
  myBubbleContainer: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexShrink: 1,
    position: 'relative', // to allow absolute-positioned check icon
  },
  myBubble: {
    backgroundColor: '#7B00FF',
    paddingBottom: 16,
  },
  otherBubble: {
    backgroundColor: '#c7c7c7',
  },
  messageText: {
    flexWrap: 'wrap',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  statusIcon: {
    position: 'absolute',
    bottom: 4,
    right: 6,
  },
  fileName: {
    flexWrap: 'wrap',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    flexWrap: 'wrap',
    fontSize: 13,
    marginBottom: 8,
  },
  downloadButton: {
    backgroundColor: '#7B00FF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  downloadText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

