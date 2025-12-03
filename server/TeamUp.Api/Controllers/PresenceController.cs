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
public class PresenceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PresenceController> _logger;

    public PresenceController(ApplicationDbContext context, ILogger<PresenceController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Get presence status for a user
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<ActionResult<UserPresenceResponse>> GetPresence(string userId)
    {
        var presence = await _context.UserPresences.FindAsync(userId);

        if (presence == null)
        {
            return Ok(new UserPresenceResponse
            {
                UserId = userId,
                IsOnline = false,
                LastSeenAt = DateTime.MinValue
            });
        }

        return Ok(new UserPresenceResponse
        {
            UserId = presence.UserId,
            IsOnline = presence.IsOnline,
            LastSeenAt = presence.LastSeenAt
        });
    }

    /// <summary>
    /// Get presence for multiple users
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<IEnumerable<UserPresenceResponse>>> GetBatchPresence([FromBody] List<string> userIds)
    {
        if (userIds == null || !userIds.Any())
            return BadRequest(new { error = "User IDs required" });

        var presences = await _context.UserPresences
            .Where(p => userIds.Contains(p.UserId))
            .ToListAsync();

        var result = userIds.Select(uid =>
        {
            var presence = presences.FirstOrDefault(p => p.UserId == uid);
            return new UserPresenceResponse
            {
                UserId = uid,
                IsOnline = presence?.IsOnline ?? false,
                LastSeenAt = presence?.LastSeenAt ?? DateTime.MinValue
            };
        });

        return Ok(result);
    }

    /// <summary>
    /// Set current user's presence status
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<UserPresenceResponse>> SetPresence([FromBody] SetPresenceRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var presence = await _context.UserPresences.FindAsync(userId);

        if (presence == null)
        {
            presence = new UserPresence
            {
                UserId = userId,
                IsOnline = request.IsOnline,
                LastSeenAt = DateTime.UtcNow
            };
            _context.UserPresences.Add(presence);
        }
        else
        {
            presence.IsOnline = request.IsOnline;
            presence.LastSeenAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogDebug("User {UserId} presence set to {IsOnline}", userId, request.IsOnline);

        return Ok(new UserPresenceResponse
        {
            UserId = presence.UserId,
            IsOnline = presence.IsOnline,
            LastSeenAt = presence.LastSeenAt
        });
    }

    /// <summary>
    /// Heartbeat to maintain online status
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<ActionResult> Heartbeat()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var presence = await _context.UserPresences.FindAsync(userId);

        if (presence == null)
        {
            presence = new UserPresence
            {
                UserId = userId,
                IsOnline = true,
                LastSeenAt = DateTime.UtcNow
            };
            _context.UserPresences.Add(presence);
        }
        else
        {
            presence.IsOnline = true;
            presence.LastSeenAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok();
    }
}

