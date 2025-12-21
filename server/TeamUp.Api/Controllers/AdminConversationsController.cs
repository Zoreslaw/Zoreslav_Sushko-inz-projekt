using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;
using TeamUp.Api.Services;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/admin/conversations")]
public class AdminConversationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminConversationsController> _logger;
    private readonly PushNotificationService _pushNotificationService;

    public AdminConversationsController(
        ApplicationDbContext context,
        ILogger<AdminConversationsController> logger,
        PushNotificationService pushNotificationService)
    {
        _context = context;
        _logger = logger;
        _pushNotificationService = pushNotificationService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminConversationSummaryResponse>>> GetConversations(
        [FromQuery] string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return BadRequest(new { error = "userId is required" });

        var exists = await _context.Users.AnyAsync(u => u.Id == userId);
        if (!exists)
            return NotFound(new { error = "User not found" });

        var conversations = await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId)
            .Include(cp => cp.Conversation)
            .OrderByDescending(cp => cp.Conversation!.LastUpdatedAt)
            .ToListAsync();

        var result = new List<AdminConversationSummaryResponse>();

        foreach (var cp in conversations)
        {
            var conv = cp.Conversation!;
            var otherParticipant = await _context.ConversationParticipants
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.ConversationId == conv.Id && p.UserId != userId);

            if (otherParticipant?.User == null) continue;

            var unreadCount = await _context.Messages
                .CountAsync(m =>
                    m.ConversationId == conv.Id &&
                    m.SenderId != userId &&
                    m.Status == "Sent");

            var presence = await _context.UserPresences
                .FirstOrDefaultAsync(p => p.UserId == otherParticipant.UserId);

            result.Add(new AdminConversationSummaryResponse
            {
                Id = conv.Id,
                OtherUserId = otherParticipant.UserId,
                OtherUserName = otherParticipant.User.DisplayName,
                OtherUserPhotoUrl = otherParticipant.User.PhotoUrl,
                OtherUserOnline = presence?.IsOnline ?? false,
                LastMessage = conv.LastMessageText,
                LastMessageTime = conv.LastMessageTimestamp,
                LastMessageSenderId = conv.LastMessageSenderId,
                UnreadCount = unreadCount,
                LastUpdatedAt = conv.LastUpdatedAt
            });
        }

        return Ok(result);
    }

    [HttpGet("between")]
    public async Task<ActionResult<AdminConversationResponse>> GetConversationBetween(
        [FromQuery] string userId,
        [FromQuery] string otherUserId)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(otherUserId))
            return BadRequest(new { error = "userId and otherUserId are required" });

        var conversationId = await FindConversationIdBetweenUsers(userId, otherUserId);
        if (string.IsNullOrEmpty(conversationId))
            return NotFound(new { error = "Conversation not found" });

        return await GetConversation(conversationId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AdminConversationResponse>> GetConversation(string id)
    {
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conversation == null)
            return NotFound(new { error = "Conversation not found" });

        var participants = new List<AdminConversationParticipantResponse>();
        foreach (var participant in conversation.Participants)
        {
            if (participant.User == null) continue;
            var presence = await _context.UserPresences
                .FirstOrDefaultAsync(p => p.UserId == participant.UserId);

            participants.Add(new AdminConversationParticipantResponse
            {
                UserId = participant.UserId,
                DisplayName = participant.User.DisplayName,
                PhotoUrl = participant.User.PhotoUrl,
                IsOnline = presence?.IsOnline ?? false,
                LastReadAt = participant.LastReadAt
            });
        }

        return Ok(new AdminConversationResponse
        {
            Id = conversation.Id,
            InitiatedBy = conversation.InitiatedBy,
            InitiatedAt = conversation.InitiatedAt,
            LastUpdatedAt = conversation.LastUpdatedAt,
            LastMessageText = conversation.LastMessageText,
            LastMessageSenderId = conversation.LastMessageSenderId,
            LastMessageTimestamp = conversation.LastMessageTimestamp,
            Participants = participants
        });
    }

    [HttpPost]
    public async Task<ActionResult<CreateConversationResponse>> CreateConversation(
        [FromBody] AdminCreateConversationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.OtherUserId))
            return BadRequest(new { error = "userId and otherUserId are required" });

        if (request.UserId == request.OtherUserId)
            return BadRequest(new { error = "Cannot create conversation with the same user" });

        var usersExist = await _context.Users
            .Where(u => u.Id == request.UserId || u.Id == request.OtherUserId)
            .Select(u => u.Id)
            .ToListAsync();

        if (!usersExist.Contains(request.UserId) || !usersExist.Contains(request.OtherUserId))
            return NotFound(new { error = "User not found" });

        var existingConversationId = await FindConversationIdBetweenUsers(
            request.UserId,
            request.OtherUserId);

        if (!string.IsNullOrEmpty(existingConversationId))
        {
            return Ok(new CreateConversationResponse
            {
                ConversationId = existingConversationId,
                IsNew = false
            });
        }

        var conversation = new Conversation
        {
            InitiatedBy = request.UserId,
            InitiatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow
        };

        _context.Conversations.Add(conversation);
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conversation.Id,
            UserId = request.UserId,
            JoinedAt = DateTime.UtcNow
        });
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conversation.Id,
            UserId = request.OtherUserId,
            JoinedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Admin created conversation {ConversationId} between {UserId} and {OtherUserId}",
            conversation.Id,
            request.UserId,
            request.OtherUserId);

        return CreatedAtAction(nameof(GetConversation), new { id = conversation.Id }, new CreateConversationResponse
        {
            ConversationId = conversation.Id,
            IsNew = true
        });
    }

    [HttpGet("{id}/messages")]
    public async Task<ActionResult<IEnumerable<MessageResponse>>> GetMessages(
        string id,
        [FromQuery] int limit = 50,
        [FromQuery] DateTime? before = null)
    {
        var conversationExists = await _context.Conversations.AnyAsync(c => c.Id == id);
        if (!conversationExists)
            return NotFound(new { error = "Conversation not found" });

        var query = _context.Messages.Where(m => m.ConversationId == id);
        if (before.HasValue)
        {
            query = query.Where(m => m.Timestamp < before.Value);
        }

        var messages = await query
            .OrderByDescending(m => m.Timestamp)
            .Take(limit)
            .OrderBy(m => m.Timestamp)
            .Select(m => new MessageResponse
            {
                Id = m.Id,
                ConversationId = m.ConversationId,
                SenderId = m.SenderId,
                RecipientId = m.RecipientId,
                Message = m.MessageText,
                MessageType = m.MessageType,
                Status = m.Status,
                Timestamp = m.Timestamp,
                Url = m.Url
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPost("{id}/messages")]
    public async Task<ActionResult<MessageResponse>> SendMessage(
        string id,
        [FromBody] AdminSendMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SenderId))
            return BadRequest(new { error = "SenderId is required" });

        var messageType = string.IsNullOrWhiteSpace(request.MessageType) ? "Text" : request.MessageType;
        var isImageMessage = messageType.Equals("Image", StringComparison.OrdinalIgnoreCase);
        if (!isImageMessage && string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Message cannot be empty" });
        if (isImageMessage && string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { error = "Image message requires a url" });

        var participants = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == id)
            .ToListAsync();

        var sender = participants.FirstOrDefault(p => p.UserId == request.SenderId);
        if (sender == null)
            return NotFound(new { error = "Sender is not part of the conversation" });

        var recipient = participants.FirstOrDefault(p => p.UserId != request.SenderId);
        if (recipient == null)
            return BadRequest(new { error = "No other participant in conversation" });

        var messageText = request.Message ?? string.Empty;
        var message = new Message
        {
            ConversationId = id,
            SenderId = request.SenderId,
            RecipientId = recipient.UserId,
            MessageText = messageText,
            MessageType = messageType,
            Status = "Sent",
            Timestamp = DateTime.UtcNow,
            Url = request.Url
        };

        _context.Messages.Add(message);

        var conversation = await _context.Conversations.FindAsync(id);
        if (conversation != null)
        {
            var previewText = isImageMessage ? "Photo" : messageText;
            conversation.LastMessageText = previewText.Length > 500
                ? previewText.Substring(0, 500)
                : previewText;
            conversation.LastMessageSenderId = request.SenderId;
            conversation.LastMessageTimestamp = message.Timestamp;
            conversation.LastUpdatedAt = message.Timestamp;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Admin sent message in conversation {ConversationId} as {UserId}", id, request.SenderId);

        await _pushNotificationService.SendToUserAsync(
            recipient.UserId,
            "New message",
            isImageMessage ? "Sent you a photo" : messageText,
            new Dictionary<string, string>
            {
                { "conversationId", id },
                { "senderId", request.SenderId }
            });

        return CreatedAtAction(nameof(GetMessages), new { id }, new MessageResponse
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            RecipientId = message.RecipientId,
            Message = message.MessageText,
            MessageType = message.MessageType,
            Status = message.Status,
            Timestamp = message.Timestamp,
            Url = message.Url
        });
    }

    [HttpPost("{id}/messages/read")]
    public async Task<ActionResult> MarkMessagesAsRead(
        string id,
        [FromBody] AdminMarkMessagesReadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
            return BadRequest(new { error = "userId is required" });

        var isParticipant = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == id && cp.UserId == request.UserId);
        if (!isParticipant)
            return NotFound(new { error = "Conversation not found for user" });

        var query = _context.Messages
            .Where(m => m.ConversationId == id && m.SenderId != request.UserId && m.Status == "Sent");

        if (request.MessageIds != null && request.MessageIds.Any())
        {
            query = query.Where(m => request.MessageIds.Contains(m.Id));
        }

        var messages = await query.ToListAsync();
        foreach (var message in messages)
        {
            message.Status = "Read";
        }

        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == request.UserId);
        if (participant != null)
        {
            participant.LastReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { marked_read = messages.Count });
    }

    [HttpDelete("{id}/messages/{messageId}")]
    public async Task<ActionResult> DeleteMessage(string id, string messageId)
    {
        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == id);

        if (message == null)
            return NotFound(new { error = "Message not found" });

        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();

        var conversation = await _context.Conversations.FindAsync(id);
        if (conversation != null)
        {
            var latest = await _context.Messages
                .Where(m => m.ConversationId == id)
                .OrderByDescending(m => m.Timestamp)
                .FirstOrDefaultAsync();

            if (latest == null)
            {
                conversation.LastMessageText = null;
                conversation.LastMessageSenderId = null;
                conversation.LastMessageTimestamp = null;
                conversation.LastUpdatedAt = conversation.InitiatedAt;
            }
            else
            {
                conversation.LastMessageText = latest.MessageType.Equals("Image", StringComparison.OrdinalIgnoreCase)
                    ? "Photo"
                    : latest.MessageText.Length > 500
                        ? latest.MessageText.Substring(0, 500)
                        : latest.MessageText;
                conversation.LastMessageSenderId = latest.SenderId;
                conversation.LastMessageTimestamp = latest.Timestamp;
                conversation.LastUpdatedAt = latest.Timestamp;
            }

            await _context.SaveChangesAsync();
        }

        return Ok(new { message = "Message deleted" });
    }

    private async Task<string?> FindConversationIdBetweenUsers(string userId, string otherUserId)
    {
        return await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId)
            .Select(cp => cp.ConversationId)
            .Intersect(
                _context.ConversationParticipants
                    .Where(cp => cp.UserId == otherUserId)
                    .Select(cp => cp.ConversationId))
            .FirstOrDefaultAsync();
    }
}
