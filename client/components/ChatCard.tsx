import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import DefaultAvatarIcon from './svgs/DefaultAvatarIcon';

interface ChatCardProps {
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadMessages: number;
  onPress: () => void;
  avatarUrl?: string;
  hasStatus?: boolean;
  statusColor?: string;
}

export default function ChatCard({ 
  name, 
  lastMessage, 
  lastMessageTime, 
  unreadMessages, 
  onPress,
  avatarUrl,
  hasStatus = false,
  statusColor = '#2CC069'
}: ChatCardProps) {
    const backgroundColor = useThemeColor({}, "background");
    const textColor = useThemeColor({}, "text");
    const textColorSecondary = useThemeColor({}, "secondaryText");
    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            {/* Avatar Section */}
            <View style={styles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                    <DefaultAvatarIcon
                        width={56}
                        height={56}
                    />
                )}
                {hasStatus && <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />}
            </View>

            {/* Data Container */}
            <View style={styles.dataContainer}>
                {/* Name and Time */}
                <View style={styles.nameContainer}>
                    <Text style={[styles.nameText, { color: textColor }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.timeText, { color: textColorSecondary }]}>{lastMessageTime}</Text>
                </View>

                {/* Message and Badge */}
                <View style={styles.messageContainer}>
                    <Text style={styles.messageText} numberOfLines={1}>{lastMessage}</Text>
                    {unreadMessages > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadMessages}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 0,
        gap: 14,
        height: 56,
        width: '100%',
    },
    avatarContainer: {
        width: 56,
        height: 56,
        position: 'relative',
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 102,
    },
    statusIndicator: {
        position: 'absolute',
        right: 2,
        top: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    dataContainer: {
        flex: 1,
        // height: 56,
        justifyContent: 'center',
        marginRight: 2,
    },
    nameContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // height: 24,
    },
    nameText: {
        flex: 1,
        fontFamily: 'Montserrat',
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
        lineHeight: 24,
    },
    timeText: {
        fontFamily: 'Montserrat',
        fontSize: 10,
        fontWeight: '400',
        color: '#A4A4A4',
        lineHeight: 16,
        marginLeft: 8,
    },
    messageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        // height: 20,
    },
    messageText: {
        flex: 1,
        fontFamily: 'Montserrat',
        fontSize: 12,
        fontWeight: '500',
        color: '#ADB5BD',
        lineHeight: 20,
    },
    badge: {
        backgroundColor: 'rgba(156, 156, 156, 0.12)',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        flexDirection: 'row',
    },
    badgeText: {
        fontFamily: 'Montserrat',
        fontSize: 10,
        fontWeight: '600',
        color: 'rgba(85, 0, 255, 0.6)',
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
});
