using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;

namespace TeamUp.Api.Services;

public class ProfileStatsService
{
    private readonly ApplicationDbContext _context;

    public ProfileStatsService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProfileStatsResponse> GetStatsAsync(string userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return new ProfileStatsResponse();
        }

        var likedIds = user.Liked ?? new List<string>();

        var matches = likedIds.Count == 0
            ? 0
            : await _context.Users.CountAsync(u => likedIds.Contains(u.Id) && u.Liked.Contains(userId));

        var messagesSent = await _context.Messages.CountAsync(m => m.SenderId == userId);
        var messagesReceived = await _context.Messages.CountAsync(m => m.RecipientId == userId);
        var conversationsStarted = await _context.Conversations.CountAsync(c => c.InitiatedBy == userId);
        var likesReceived = await _context.Users.CountAsync(u => u.Liked.Contains(userId));

        var presence = await _context.UserPresences.FirstOrDefaultAsync(p => p.UserId == userId);

        return new ProfileStatsResponse
        {
            Matches = matches,
            MessagesSent = messagesSent,
            MessagesReceived = messagesReceived,
            ConversationsStarted = conversationsStarted,
            LikesGiven = likedIds.Count,
            LikesReceived = likesReceived,
            LastActiveAt = presence?.LastSeenAt ?? user.UpdatedAt
        };
    }
}
