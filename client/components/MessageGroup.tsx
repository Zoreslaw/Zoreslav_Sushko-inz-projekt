import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ConversationBubble from './ConversationBubble';
import type { MessageGroup } from '@/utils/groupMessagesByUser';

// Helper function to format the timestamp based on current time
function formatTimestamp(timestamp: number, currentTime: number): string {
  const diff = currentTime - timestamp;
  const minutesAgo = Math.floor(diff / 60000);
  if (minutesAgo < 1) return 'just now';
  if (minutesAgo === 1) return '1 min ago';
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
}

interface MessageGroupProps {
  group: MessageGroup;
  myUserId: string | undefined;
}

export default function MessageGroup({ group, myUserId }: MessageGroupProps) {
  const { userId, messages } = group;
  const isMine = userId === myUserId;

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const lastTimestamp = messages[messages.length - 1].timestamp;
  const timeLabel = formatTimestamp(lastTimestamp, currentTime);

  return (
    <View style={[styles.groupContainer, isMine ? styles.groupRight : styles.groupLeft]}>
      {messages.map((msg) => (
        <ConversationBubble
          key={msg.id}
          text={msg.message}
          isMine={isMine}
          timestamp={msg.timestamp}
          type={msg.messageType as 'Text' | 'File'}
          status={msg.status as 'Sent' | 'Read'}
          // fileName={msg.fileName}
          // fileSize={msg.fileSize}
        />
      ))}
      <Text style={[styles.timestamp, isMine && styles.timestampRight]}>
        {timeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupContainer: {
    marginVertical: 8,
  },
  groupLeft: {
    alignItems: 'flex-start',
  },
  groupRight: {
    alignItems: 'flex-end',
  },
  timestamp: {
    marginTop: 4,
    fontSize: 12,
    color: '#8A9099',
    alignSelf: 'flex-start',
  },
  timestampRight: {
    alignSelf: 'flex-end',
  },
});
