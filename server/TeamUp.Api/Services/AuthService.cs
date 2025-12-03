using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;
using Google.Apis.Auth;

namespace TeamUp.Api.Services;

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly JwtService _jwtService;
    private readonly ILogger<AuthService> _logger;
    private readonly IConfiguration _configuration;

    public AuthService(
        ApplicationDbContext context,
        JwtService jwtService,
        ILogger<AuthService> logger,
        IConfiguration configuration)
    {
        _context = context;
        _jwtService = jwtService;
        _logger = logger;
        _configuration = configuration;
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

    public async Task<AuthResponse?> GoogleLoginAsync(string idToken)
    {
        try
        {
            var googleClientId = _configuration["Authentication:Google:ClientId"];
            
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { googleClientId }
            });

            var user = await _context.Users
                .FirstOrDefaultAsync(u => 
                    (u.AuthProvider == "Google" && u.ProviderId == payload.Subject) ||
                    u.Email.ToLower() == payload.Email.ToLower());

            if (user == null)
            {
                // Create new user
                user = new User
                {
                    Email = payload.Email.ToLower(),
                    DisplayName = payload.Name ?? payload.Email.Split('@')[0],
                    PhotoUrl = payload.Picture,
                    AuthProvider = "Google",
                    ProviderId = payload.Subject,
                    Gender = "Other",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                
                var presence = new UserPresence
                {
                    UserId = user.Id,
                    IsOnline = false,
                    LastSeenAt = DateTime.UtcNow
                };
                _context.UserPresences.Add(presence);

                await _context.SaveChangesAsync();
                _logger.LogInformation("New user created via Google: {UserId}", user.Id);
            }
            else if (user.AuthProvider != "Google")
            {
                // Link Google account to existing user
                user.AuthProvider = "Google";
                user.ProviderId = payload.Subject;
                if (string.IsNullOrEmpty(user.PhotoUrl))
                {
                    user.PhotoUrl = payload.Picture;
                }
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return await GenerateAuthResponseAsync(user);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Invalid Google ID token");
            return null;
        }
    }

    public async Task<AuthResponse?> AppleLoginAsync(string idToken)
    {
        try
        {
            // Decode Apple ID token (simplified - in production use proper validation)
            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var token = handler.ReadJwtToken(idToken);
            
            var email = token.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
            var sub = token.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;

            if (string.IsNullOrEmpty(sub))
            {
                _logger.LogWarning("Apple login failed: missing subject");
                return null;
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => 
                    (u.AuthProvider == "Apple" && u.ProviderId == sub) ||
                    (!string.IsNullOrEmpty(email) && u.Email.ToLower() == email.ToLower()));

            if (user == null)
            {
                user = new User
                {
                    Email = email?.ToLower() ?? $"apple_{sub}@private.apple.com",
                    DisplayName = email?.Split('@')[0] ?? "Apple User",
                    AuthProvider = "Apple",
                    ProviderId = sub,
                    Gender = "Other",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                
                var presence = new UserPresence
                {
                    UserId = user.Id,
                    IsOnline = false,
                    LastSeenAt = DateTime.UtcNow
                };
                _context.UserPresences.Add(presence);

                await _context.SaveChangesAsync();
                _logger.LogInformation("New user created via Apple: {UserId}", user.Id);
            }

            return await GenerateAuthResponseAsync(user);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Apple login failed");
            return null;
        }
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

