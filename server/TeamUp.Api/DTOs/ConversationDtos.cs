namespace TeamUp.Api.DTOs;

// Conversation DTOs
public class ConversationResponse
{
    public string Id { get; set; } = string.Empty;
    public string OtherUserId { get; set; } = string.Empty;
    public string OtherUserName { get; set; } = string.Empty;
    public string? OtherUserPhotoUrl { get; set; }
    public bool OtherUserOnline { get; set; }
    public string? LastMessage { get; set; }
    public DateTime? LastMessageTime { get; set; }
    public string? LastMessageSenderId { get; set; }
    public int UnreadCount { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}

public class CreateConversationRequest
{
    public string OtherUserId { get; set; } = string.Empty;
}

public class CreateConversationResponse
{
    public string ConversationId { get; set; } = string.Empty;
    public bool IsNew { get; set; }
}

// Message DTOs
public class MessageResponse
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string RecipientId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text";
    public string Status { get; set; } = "Sent";
    public DateTime Timestamp { get; set; }
    public string? Url { get; set; }
}

public class SendMessageRequest
{
    public string Message { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text";
    public string? Url { get; set; }
}

public class MarkMessagesReadRequest
{
    public List<string>? MessageIds { get; set; } // If null, mark all as read
}

// Presence DTOs
public class UserPresenceResponse
{
    public string UserId { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public DateTime LastSeenAt { get; set; }
}

public class SetPresenceRequest
{
    public bool IsOnline { get; set; }
}












