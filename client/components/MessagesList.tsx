import React, { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import MessageGroup from './MessageGroup';
import { groupMessagesByUser, Message } from '@/utils/groupMessagesByUser';

interface MessagesListProps {
  messages: Message[];
  myUserId: string | undefined;
}

export default function MessagesList({ messages, myUserId }: MessagesListProps) {
  // Group messages whenever `messages` changes
  const groups = useMemo(() => groupMessagesByUser(messages), [messages]);

  // Each group is an item in the list
  const renderItem = ({ item }: { item: any }) => {
    return <MessageGroup group={item} myUserId={myUserId} />;
  };

  return (
    <FlatList
      data={groups}
      renderItem={renderItem}
      keyExtractor={(_, index) => `group-${index}`}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
});
