using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamUp.Api.DTOs;
using TeamUp.Api.Services;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(AuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Register a new user with email and password
    /// </summary>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || 
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return BadRequest(new { error = "Email, password and display name are required" });
        }

        if (request.Password.Length < 6)
        {
            return BadRequest(new { error = "Password must be at least 6 characters" });
        }

        var result = await _authService.RegisterAsync(request);
        
        if (result == null)
        {
            return Conflict(new { error = "Email already registered" });
        }

        _logger.LogInformation("User registered: {UserId}", result.UserId);
        return Ok(result);
    }

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required" });
        }

        var result = await _authService.LoginAsync(request);
        
        if (result == null)
        {
            return Unauthorized(new { error = "Invalid email or password" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Login with Google ID token
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleLogin([FromBody] SocialLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            return BadRequest(new { error = "ID token is required" });
        }

        var result = await _authService.GoogleLoginAsync(request.IdToken);
        
        if (result == null)
        {
            return Unauthorized(new { error = "Invalid Google token" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Login with Apple ID token
    /// </summary>
    [HttpPost("apple")]
    public async Task<ActionResult<AuthResponse>> AppleLogin([FromBody] SocialLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            return BadRequest(new { error = "ID token is required" });
        }

        var result = await _authService.AppleLoginAsync(request.IdToken);
        
        if (result == null)
        {
            return Unauthorized(new { error = "Invalid Apple token" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new { error = "Refresh token is required" });
        }

        var result = await _authService.RefreshTokenAsync(request.RefreshToken);
        
        if (result == null)
        {
            return Unauthorized(new { error = "Invalid or expired refresh token" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Logout - revoke refresh tokens
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult> Logout([FromBody] RefreshTokenRequest? request = null)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        await _authService.RevokeTokenAsync(userId, request?.RefreshToken);
        
        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Get current user info from token
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public ActionResult<object> GetCurrentUser()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var name = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

        return Ok(new
        {
            userId,
            email,
            displayName = name
        });
    }
}


