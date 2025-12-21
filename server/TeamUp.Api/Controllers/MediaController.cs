using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MediaController : ControllerBase
{
    private readonly ILogger<MediaController> _logger;
    private readonly IWebHostEnvironment _environment;

    public MediaController(ILogger<MediaController> logger, IWebHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Upload image for chat messages
    /// </summary>
    [HttpPost("messages")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<object>> UploadMessageImage(IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded" });

        var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Invalid file type. Allowed: jpeg, png, gif, webp" });

        try
        {
            var uploadsPath = Path.Combine(_environment.ContentRootPath, "uploads", "messages");
            Directory.CreateDirectory(uploadsPath);

            var extension = Path.GetExtension(file.FileName);
            var fileName = $"{userId}_{DateTime.UtcNow.Ticks}{extension}";
            var filePath = Path.Combine(uploadsPath, fileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var url = $"/uploads/messages/{fileName}";

            _logger.LogInformation("Chat media uploaded for user {UserId}", userId);

            return Ok(new { url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading chat media for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to upload media" });
        }
    }
}
