namespace TeamUp.Api.DTOs;

// Registration
public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

// Login
public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// Auth Response
public class AuthResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

// Token Refresh
public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

// User Profile DTOs
public class UserProfileResponse
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FavoriteCategory { get; set; }
    public List<string> FavoriteGames { get; set; } = new();
    public List<string> OtherGames { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public List<string> PreferenceCategories { get; set; } = new();
    public List<string> PreferenceLanguages { get; set; } = new();
    public string? PreferenceGender { get; set; }
    public int? PreferenceAgeMin { get; set; }
    public int? PreferenceAgeMax { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateProfileRequest
{
    public string? DisplayName { get; set; }
    public string? PhotoUrl { get; set; }
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? Description { get; set; }
    public string? FavoriteCategory { get; set; }
    public List<string>? FavoriteGames { get; set; }
    public List<string>? OtherGames { get; set; }
    public List<string>? Languages { get; set; }
    public List<string>? PreferenceCategories { get; set; }
    public List<string>? PreferenceLanguages { get; set; }
    public string? PreferenceGender { get; set; }
    public int? PreferenceAgeMin { get; set; }
    public int? PreferenceAgeMax { get; set; }
}

// Match DTOs
public class MatchResponse
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> FavoriteGames { get; set; } = new();
    public List<string> OtherGames { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public List<string> PreferenceCategories { get; set; } = new();
    public double Score { get; set; }
    public bool IsMatch { get; set; } // Has this user liked the current user?
}

public class SwipeActionRequest
{
    public string TargetUserId { get; set; } = string.Empty;
}

public class SwipeActionResponse
{
    public bool Success { get; set; }
    public bool IsMatch { get; set; }
    public string? ConversationId { get; set; }
    public string? Message { get; set; }
}







