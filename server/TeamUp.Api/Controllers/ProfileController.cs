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
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProfileController> _logger;
    private readonly IWebHostEnvironment _environment;

    public ProfileController(
        ApplicationDbContext context, 
        ILogger<ProfileController> logger,
        IWebHostEnvironment environment)
    {
        _context = context;
        _logger = logger;
        _environment = environment;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Get current user's profile
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<UserProfileResponse>> GetProfile()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new { error = "User not found" });

        return Ok(MapToProfileResponse(user));
    }

    /// <summary>
    /// Get a user's public profile by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<UserProfileResponse>> GetUserProfile(string id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { error = "User not found" });

        return Ok(MapToProfileResponse(user));
    }

    /// <summary>
    /// Update current user's profile
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<UserProfileResponse>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new { error = "User not found" });

        // Update fields if provided
        if (request.DisplayName != null)
            user.DisplayName = request.DisplayName;
        
        if (request.PhotoUrl != null)
            user.PhotoUrl = request.PhotoUrl;
        
        if (request.Age.HasValue)
            user.Age = request.Age.Value;
        
        if (request.Gender != null)
            user.Gender = request.Gender;
        
        if (request.Description != null)
            user.Description = request.Description;
        
        if (request.FavoriteCategory != null)
            user.FavoriteCategory = request.FavoriteCategory;
        
        if (request.FavoriteGames != null)
            user.FavoriteGames = request.FavoriteGames;
        
        if (request.OtherGames != null)
            user.OtherGames = request.OtherGames;
        
        if (request.Languages != null)
            user.Languages = request.Languages;
        
        if (request.PreferenceCategories != null)
            user.PreferenceCategories = request.PreferenceCategories;
        
        if (request.PreferenceLanguages != null)
            user.PreferenceLanguages = request.PreferenceLanguages;
        
        if (request.PreferenceGender != null)
            user.PreferenceGender = request.PreferenceGender;
        
        if (request.PreferenceAgeMin.HasValue)
            user.PreferenceAgeMin = request.PreferenceAgeMin.Value;
        
        if (request.PreferenceAgeMax.HasValue)
            user.PreferenceAgeMax = request.PreferenceAgeMax.Value;

        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile updated for user {UserId}", userId);

        return Ok(MapToProfileResponse(user));
    }

    /// <summary>
    /// Upload avatar image
    /// </summary>
    [HttpPost("avatar")]
    [RequestSizeLimit(5_000_000)] // 5MB limit
    public async Task<ActionResult<object>> UploadAvatar(IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded" });

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Invalid file type. Allowed: jpeg, png, gif, webp" });

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new { error = "User not found" });

        try
        {
            // Create uploads directory if it doesn't exist
            var uploadsPath = Path.Combine(_environment.ContentRootPath, "uploads", "avatars");
            Directory.CreateDirectory(uploadsPath);

            // Generate unique filename
            var extension = Path.GetExtension(file.FileName);
            var fileName = $"{userId}_{DateTime.UtcNow.Ticks}{extension}";
            var filePath = Path.Combine(uploadsPath, fileName);

            // Delete old avatar if exists
            if (!string.IsNullOrEmpty(user.PhotoUrl) && user.PhotoUrl.StartsWith("/uploads/"))
            {
                var oldPath = Path.Combine(_environment.ContentRootPath, user.PhotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldPath))
                {
                    System.IO.File.Delete(oldPath);
                }
            }

            // Save new file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Update user's photo URL
            user.PhotoUrl = $"/uploads/avatars/{fileName}";
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Avatar uploaded for user {UserId}", userId);

            return Ok(new { photoUrl = user.PhotoUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading avatar for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to upload avatar" });
        }
    }

    private static UserProfileResponse MapToProfileResponse(User user)
    {
        return new UserProfileResponse
        {
            Id = user.Id,
            DisplayName = user.DisplayName,
            Email = user.Email,
            PhotoUrl = user.PhotoUrl,
            Age = user.Age,
            Gender = user.Gender,
            Description = user.Description,
            FavoriteCategory = user.FavoriteCategory,
            FavoriteGames = user.FavoriteGames,
            OtherGames = user.OtherGames,
            Languages = user.Languages,
            PreferenceCategories = user.PreferenceCategories,
            PreferenceLanguages = user.PreferenceLanguages,
            PreferenceGender = user.PreferenceGender,
            PreferenceAgeMin = user.PreferenceAgeMin,
            PreferenceAgeMax = user.PreferenceAgeMax,
            CreatedAt = user.CreatedAt
        };
    }
}











