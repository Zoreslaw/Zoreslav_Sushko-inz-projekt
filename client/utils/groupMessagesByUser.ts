export interface Message {
    id: string;
    message: string;
    messageType: string;  // e.g. "Text", "Image", "Video"
    senderId: string;
    recipientId: string;
    status: string;       // e.g. "Sent", "Delivered", "Read"
    timestamp: number;
    url?: string;
  }
  
  export interface MessageGroup {
    userId: string;
    messages: Message[];
  }
  
  export function groupMessagesByUser(messages: Message[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    let currentGroup: Message[] = [];
    let currentUser: string | null = null;
  
    for (const msg of messages) {
      // If it's a different user, start a new group
      if (msg.senderId !== currentUser) {
        if (currentGroup.length > 0 && currentUser) {
          groups.push({ userId: currentUser, messages: currentGroup });
        }
        currentGroup = [msg];
        currentUser = msg.senderId;
      } else {
        // Same user, so just add to current group
        currentGroup.push(msg);
      }
    }
  
    // Push the final group if not empty
    if (currentGroup.length > 0 && currentUser) {
      groups.push({ userId: currentUser, messages: currentGroup });
    }
  
    return groups;
  }
  