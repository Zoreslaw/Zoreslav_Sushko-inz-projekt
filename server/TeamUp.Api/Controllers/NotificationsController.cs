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
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(ApplicationDbContext context, ILogger<NotificationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpPost("devices")]
    public async Task<ActionResult<DeviceTokenResponse>> RegisterDevice([FromBody] RegisterDeviceTokenRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { error = "Device token is required" });

        var existing = await _context.DeviceTokens
            .FirstOrDefaultAsync(t => t.Token == request.Token);

        if (existing == null)
        {
            existing = new DeviceToken
            {
                UserId = userId,
                Token = request.Token,
                Platform = request.Platform,
                DeviceId = request.DeviceId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow
            };
            _context.DeviceTokens.Add(existing);
        }
        else
        {
            existing.UserId = userId;
            existing.Platform = request.Platform;
            existing.DeviceId = request.DeviceId;
            existing.IsActive = true;
            existing.LastUsedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Registered device token for user {UserId}", userId);

        return Ok(new DeviceTokenResponse
        {
            Token = existing.Token,
            Platform = existing.Platform,
            IsActive = existing.IsActive
        });
    }

    [HttpPost("devices/unregister")]
    public async Task<ActionResult> UnregisterDevice([FromBody] UnregisterDeviceTokenRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { error = "Device token is required" });

        var token = await _context.DeviceTokens
            .FirstOrDefaultAsync(t => t.Token == request.Token && t.UserId == userId);

        if (token == null)
            return NotFound(new { error = "Device token not found" });

        token.IsActive = false;
        token.LastUsedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }
}
