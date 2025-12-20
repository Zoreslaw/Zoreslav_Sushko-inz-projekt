using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Mappers;
using TeamUp.Api.Services;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SteamController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly SteamService _steamService;
    private readonly ILogger<SteamController> _logger;

    public SteamController(ApplicationDbContext context, SteamService steamService, ILogger<SteamController> logger)
    {
        _context = context;
        _steamService = steamService;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpPost("connect")]
    public async Task<ActionResult<UserProfileResponse>> ConnectSteam([FromBody] SteamConnectRequest request)
    {
        if (!_steamService.HasApiKey)
        {
            return BadRequest(new { error = "Steam API key is not configured." });
        }

        if (request == null || string.IsNullOrWhiteSpace(request.SteamIdOrUrl))
        {
            return BadRequest(new { error = "Steam ID or profile URL is required." });
        }

        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        try
        {
            var result = await _steamService.ConnectAsync(request.SteamIdOrUrl);
            user.SteamId = result.SteamId;
            user.SteamDisplayName = result.SteamDisplayName;
            user.SteamProfileUrl = result.SteamProfileUrl;
            user.SteamAvatarUrl = result.SteamAvatarUrl;
            user.SteamGames = result.Games;
            user.SteamCategories = result.Categories;
            user.SteamLastSyncedAt = result.SyncedAt;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Steam account connected for user {UserId}", userId);

            return Ok(ProfileMapper.ToProfileResponse(user));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("disconnect")]
    public async Task<ActionResult<UserProfileResponse>> DisconnectSteam()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        user.SteamId = null;
        user.SteamDisplayName = null;
        user.SteamProfileUrl = null;
        user.SteamAvatarUrl = null;
        user.SteamGames = new List<string>();
        user.SteamCategories = new List<string>();
        user.SteamLastSyncedAt = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        _logger.LogInformation("Steam account disconnected for user {UserId}", userId);

        return Ok(ProfileMapper.ToProfileResponse(user));
    }

    [HttpPost("sync")]
    public async Task<ActionResult<UserProfileResponse>> SyncSteam()
    {
        if (!_steamService.HasApiKey)
        {
            return BadRequest(new { error = "Steam API key is not configured." });
        }

        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        if (string.IsNullOrWhiteSpace(user.SteamId))
        {
            return BadRequest(new { error = "Steam account is not connected." });
        }

        try
        {
            var result = await _steamService.ConnectAsync(user.SteamId);
            user.SteamDisplayName = result.SteamDisplayName;
            user.SteamProfileUrl = result.SteamProfileUrl;
            user.SteamAvatarUrl = result.SteamAvatarUrl;
            user.SteamGames = result.Games;
            user.SteamCategories = result.Categories;
            user.SteamLastSyncedAt = result.SyncedAt;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Steam account synced for user {UserId}", userId);

            return Ok(ProfileMapper.ToProfileResponse(user));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("catalog")]
    public async Task<ActionResult<SteamCatalogResponse>> GetCatalog([FromQuery] string type, [FromQuery] string? query, [FromQuery] int? limit)
    {
        var normalized = type?.Trim().ToLowerInvariant();
        List<string> items;

        switch (normalized)
        {
            case "games":
                items = await _steamService.SearchAppsAsync(query ?? string.Empty, limit);
                break;
            case "categories":
                items = await _steamService.SearchCategoriesAsync(query ?? string.Empty, limit);
                break;
            default:
                return BadRequest(new { error = "Invalid catalog type. Use 'games' or 'categories'." });
        }

        return Ok(new SteamCatalogResponse { Items = items });
    }
}
