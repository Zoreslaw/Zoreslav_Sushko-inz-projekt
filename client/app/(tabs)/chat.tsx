import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import SearchInput from '@/components/SearchInput';
import ChatCard from '@/components/ChatCard';
import ChatCardPlaceholder from '@/components/ChatCardPlaceholder';
import { useRouter } from 'expo-router';
import { useUserPresence } from '@/hooks/useUserPresence';
import { createOrGetConversation } from '@/utils/createOrGetConversation';

const ChatCardWithPresence = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const isOnline = useUserPresence(item.otherUserId);
  
  return (
    <ChatCard
      name={item.name}
      lastMessage={item.lastMessage}
      lastMessageTime={item.lastMessageTime}
      unreadMessages={item.unreadMessages}
      onPress={onPress}
      avatarUrl={item.avatarUrl}
      hasStatus={isOnline}
      statusColor={item.statusColor}
    />
  );
};

export default function Chat() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const router = useRouter();
  
  const handleCreateConversation = async () => {
    if (!user?.uid) {
      console.error('No user ID available');
      return;
    }
    
    console.log('Creating conversation with:', {
      currentUserId: user.uid,
      otherUserId: 'GkQAhpVok5V0KuETl67wesA42dA2'
    });

    try {
      const conversationId = await createOrGetConversation(user.uid, 'GkQAhpVok5V0KuETl67wesA42dA2');
      console.log('Successfully created/found conversation:', conversationId);
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const { conversations, loading, error } = useConversations();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(convo =>
      convo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, conversations]);

  // Render function for each conversation item
  const renderChatItem = ({ item }: any) => (
    <ChatCardWithPresence
      item={item}
      onPress={() => router.push(`/conversation/${item.id}`)}
    />
  );

  if (loading) {
    return (
      <View style={[styles.appContainer, { backgroundColor, paddingTop: 16 }]}>
        <SearchInput placeholder="Search" onChangeText={setSearchQuery} value={searchQuery} />
        <FlatList
          data={[1, 2, 3, 4, 5]} // dummy data to generate placeholders
          renderItem={() => <ChatCardPlaceholder />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={styles.chatCardsContainer}
          showsVerticalScrollIndicator={false}
          bounces={true}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={() => <View style={{ height: 16 }} />}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.appContainer, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.appContainer, { backgroundColor }]}>
      <View style={styles.chatsContainer}>
        <SearchInput placeholder="Search" onChangeText={setSearchQuery} value={searchQuery} />
        
        <FlatList
          data={filteredConversations}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatCardsContainer}
          showsVerticalScrollIndicator={false}
          bounces={true}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={() => <View style={{ height: 16 }} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  chatsContainer: {
    flex: 1,
    marginTop: 16,
  },
  chatCardsContainer: {},
  separator: {
    height: 20,
  },
});
