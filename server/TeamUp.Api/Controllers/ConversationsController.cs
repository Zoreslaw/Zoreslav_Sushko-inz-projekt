using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ConversationsController> _logger;

    public ConversationsController(ApplicationDbContext context, ILogger<ConversationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Get all conversations for the current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ConversationResponse>>> GetConversations()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var conversations = await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId)
            .Include(cp => cp.Conversation)
            .OrderByDescending(cp => cp.Conversation!.LastUpdatedAt)
            .ToListAsync();

        var result = new List<ConversationResponse>();

        foreach (var cp in conversations)
        {
            var conv = cp.Conversation!;
            
            // Get the other participant
            var otherParticipant = await _context.ConversationParticipants
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.ConversationId == conv.Id && p.UserId != userId);

            if (otherParticipant?.User == null) continue;

            // Get unread count
            var unreadCount = await _context.Messages
                .CountAsync(m => 
                    m.ConversationId == conv.Id && 
                    m.SenderId != userId && 
                    m.Status == "Sent");

            // Get presence
            var presence = await _context.UserPresences
                .FirstOrDefaultAsync(p => p.UserId == otherParticipant.UserId);

            result.Add(new ConversationResponse
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

    /// <summary>
    /// Get a specific conversation by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ConversationResponse>> GetConversation(string id)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Verify user is a participant
        var participant = await _context.ConversationParticipants
            .Include(cp => cp.Conversation)
            .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId);

        if (participant == null)
            return NotFound(new { error = "Conversation not found" });

        var conv = participant.Conversation!;

        // Get the other participant
        var otherParticipant = await _context.ConversationParticipants
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.ConversationId == id && p.UserId != userId);

        if (otherParticipant?.User == null)
            return NotFound(new { error = "Other participant not found" });

        var unreadCount = await _context.Messages
            .CountAsync(m => 
                m.ConversationId == id && 
                m.SenderId != userId && 
                m.Status == "Sent");

        var presence = await _context.UserPresences
            .FirstOrDefaultAsync(p => p.UserId == otherParticipant.UserId);

        return Ok(new ConversationResponse
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

    /// <summary>
    /// Create a new conversation or get existing one
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CreateConversationResponse>> CreateConversation([FromBody] CreateConversationRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrEmpty(request.OtherUserId))
            return BadRequest(new { error = "Other user ID is required" });

        if (userId == request.OtherUserId)
            return BadRequest(new { error = "Cannot create conversation with yourself" });

        // Check if other user exists
        var otherUser = await _context.Users.FindAsync(request.OtherUserId);
        if (otherUser == null)
            return NotFound(new { error = "User not found" });

        // Check for existing conversation
        var existingConversation = await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId)
            .Select(cp => cp.ConversationId)
            .Intersect(
                _context.ConversationParticipants
                    .Where(cp => cp.UserId == request.OtherUserId)
                    .Select(cp => cp.ConversationId)
            )
            .FirstOrDefaultAsync();

        if (!string.IsNullOrEmpty(existingConversation))
        {
            _logger.LogInformation("Found existing conversation {ConversationId}", existingConversation);
            return Ok(new CreateConversationResponse
            {
                ConversationId = existingConversation,
                IsNew = false
            });
        }

        // Create new conversation
        var conversation = new Conversation
        {
            InitiatedBy = userId,
            InitiatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow
        };

        _context.Conversations.Add(conversation);

        // Add participants
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conversation.Id,
            UserId = userId,
            JoinedAt = DateTime.UtcNow
        });

        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conversation.Id,
            UserId = request.OtherUserId,
            JoinedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        _logger.LogInformation("Created new conversation {ConversationId} between {UserId} and {OtherUserId}",
            conversation.Id, userId, request.OtherUserId);

        return CreatedAtAction(nameof(GetConversation), new { id = conversation.Id }, new CreateConversationResponse
        {
            ConversationId = conversation.Id,
            IsNew = true
        });
    }

    /// <summary>
    /// Get messages in a conversation
    /// </summary>
    [HttpGet("{id}/messages")]
    public async Task<ActionResult<IEnumerable<MessageResponse>>> GetMessages(
        string id,
        [FromQuery] int limit = 50,
        [FromQuery] DateTime? before = null)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Verify user is a participant
        var isParticipant = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId);

        if (!isParticipant)
            return NotFound(new { error = "Conversation not found" });

        var query = _context.Messages
            .Where(m => m.ConversationId == id);

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

    /// <summary>
    /// Send a message in a conversation
    /// </summary>
    [HttpPost("{id}/messages")]
    public async Task<ActionResult<MessageResponse>> SendMessage(string id, [FromBody] SendMessageRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Message cannot be empty" });

        // Verify user is a participant and get other participant
        var participants = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == id)
            .ToListAsync();

        var currentParticipant = participants.FirstOrDefault(p => p.UserId == userId);
        if (currentParticipant == null)
            return NotFound(new { error = "Conversation not found" });

        var otherParticipant = participants.FirstOrDefault(p => p.UserId != userId);
        if (otherParticipant == null)
            return BadRequest(new { error = "No other participant in conversation" });

        var message = new Message
        {
            ConversationId = id,
            SenderId = userId,
            RecipientId = otherParticipant.UserId,
            MessageText = request.Message,
            MessageType = request.MessageType,
            Status = "Sent",
            Timestamp = DateTime.UtcNow,
            Url = request.Url
        };

        _context.Messages.Add(message);

        // Update conversation's last message
        var conversation = await _context.Conversations.FindAsync(id);
        if (conversation != null)
        {
            conversation.LastMessageText = request.Message.Length > 500 
                ? request.Message.Substring(0, 500) 
                : request.Message;
            conversation.LastMessageSenderId = userId;
            conversation.LastMessageTimestamp = message.Timestamp;
            conversation.LastUpdatedAt = message.Timestamp;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Message sent in conversation {ConversationId} by {UserId}", id, userId);

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

    /// <summary>
    /// Mark messages as read
    /// </summary>
    [HttpPost("{id}/messages/read")]
    public async Task<ActionResult> MarkMessagesAsRead(string id, [FromBody] MarkMessagesReadRequest? request = null)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Verify user is a participant
        var isParticipant = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId);

        if (!isParticipant)
            return NotFound(new { error = "Conversation not found" });

        var query = _context.Messages
            .Where(m => m.ConversationId == id && m.SenderId != userId && m.Status == "Sent");

        if (request?.MessageIds != null && request.MessageIds.Any())
        {
            query = query.Where(m => request.MessageIds.Contains(m.Id));
        }

        var messages = await query.ToListAsync();

        foreach (var message in messages)
        {
            message.Status = "Read";
        }

        // Update last read timestamp for participant
        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId);

        if (participant != null)
        {
            participant.LastReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { marked_read = messages.Count });
    }
}


