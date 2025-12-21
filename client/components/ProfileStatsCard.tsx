import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ProfileStats } from '@/services/api';

interface ProfileStatsCardProps {
  stats: ProfileStats | null;
  loading?: boolean;
}

export default function ProfileStatsCard({ stats, loading }: ProfileStatsCardProps) {
  const cardBackground = useThemeColor({}, 'secondaryBackground');
  const textColor = useThemeColor({}, 'text');
  const secondaryText = useThemeColor({}, 'secondaryText');

  const totalMessages = stats ? stats.messagesSent + stats.messagesReceived : 0;
  const lastActiveLabel = stats?.lastActiveAt
    ? new Date(stats.lastActiveAt).toLocaleDateString()
    : '—';

  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]}>
      <Text style={[styles.title, { color: textColor }]}>
        {loading ? 'Loading stats...' : 'Your activity'}
      </Text>
      <View style={styles.row}>
        <StatPill label="Matches" value={stats?.matches ?? 0} />
        <StatPill label="Messages" value={totalMessages} />
        <StatPill label="Likes" value={stats?.likesReceived ?? 0} />
      </View>
      <View style={styles.row}>
        <Text style={[styles.meta, { color: secondaryText }]}>
          Conversations started: {stats?.conversationsStarted ?? 0}
        </Text>
        <Text style={[styles.meta, { color: secondaryText }]}>
          Last active: {lastActiveLabel}
        </Text>
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  const textColor = useThemeColor({}, 'text');
  const secondaryText = useThemeColor({}, 'secondaryText');

  return (
    <View style={styles.pill}>
      <Text style={[styles.pillValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color: secondaryText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  pillValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  pillLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    marginTop: 12,
  },
});
