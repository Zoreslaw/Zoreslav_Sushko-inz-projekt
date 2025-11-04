import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import ConversationHeader from '@/components/ConversationHeader';
import ConversationInput from '@/components/ConversationInput';
import MessagesList from '@/components/MessagesList';
import { useMessages } from '@/hooks/useMessages';
import { useConversationInfo } from '@/hooks/useConversationInfo';

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationId = params.conversationId || '';
  const { user } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const { messages, loading, error, sendMessage, markAsRead } = useMessages(conversationId);
  const { otherUserName } = useConversationInfo(conversationId);

  useEffect(() => {
    if (markAsRead && conversationId) {
      markAsRead();
    }
  }, [markAsRead, conversationId]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage(text);
    },
    [sendMessage]
  );

  if (!conversationId) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={styles.errorText}>No conversationId provided</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <ActivityIndicator size="large" color="#7B00FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // MAIN RENDER
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ConversationHeader title={otherUserName} onBackPress={() => router.back()} />
      <MessagesList messages={messages} myUserId={user?.uid} />      
      <ConversationInput onSend={handleSend} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
  },
});
