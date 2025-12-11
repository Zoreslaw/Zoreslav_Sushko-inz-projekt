using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly JwtService _jwtService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ApplicationDbContext context,
        JwtService jwtService,
        ILogger<AuthService> logger)
    {
        _context = context;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // Check if email already exists
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (existingUser != null)
        {
            _logger.LogWarning("Registration failed: email already exists {Email}", request.Email);
            return null;
        }

        var user = new User
        {
            Email = request.Email.ToLower(),
            DisplayName = request.DisplayName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            AuthProvider = "Email",
            Gender = "Other", // Default, user can update later
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        
        // Create presence record
        var presence = new UserPresence
        {
            UserId = user.Id,
            IsOnline = false,
            LastSeenAt = DateTime.UtcNow
        };
        _context.UserPresences.Add(presence);

        await _context.SaveChangesAsync();

        _logger.LogInformation("User registered successfully: {UserId}", user.Id);

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (user == null)
        {
            _logger.LogWarning("Login failed: user not found {Email}", request.Email);
            return null;
        }

        if (user.AuthProvider != "Email" || string.IsNullOrEmpty(user.PasswordHash))
        {
            _logger.LogWarning("Login failed: user registered with {Provider}", user.AuthProvider);
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Login failed: invalid password for {Email}", request.Email);
            return null;
        }

        _logger.LogInformation("User logged in: {UserId}", user.Id);

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken)
    {
        var storedToken = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (storedToken == null || !storedToken.IsActive || storedToken.User == null)
        {
            _logger.LogWarning("Refresh token invalid or expired");
            return null;
        }

        // Revoke old token
        storedToken.RevokedAt = DateTime.UtcNow;

        // Generate new tokens
        var response = await GenerateAuthResponseAsync(storedToken.User);
        
        storedToken.ReplacedByToken = response?.RefreshToken;
        await _context.SaveChangesAsync();

        return response;
    }

    public async Task<bool> RevokeTokenAsync(string userId, string? refreshToken = null)
    {
        var query = _context.RefreshTokens.Where(rt => rt.UserId == userId && rt.RevokedAt == null);
        
        if (!string.IsNullOrEmpty(refreshToken))
        {
            query = query.Where(rt => rt.Token == refreshToken);
        }

        var tokens = await query.ToListAsync();
        
        foreach (var token in tokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<AuthResponse> GenerateAuthResponseAsync(User user)
    {
        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            PhotoUrl = user.PhotoUrl,
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(60) // Match JWT expiration
        };
    }
}







