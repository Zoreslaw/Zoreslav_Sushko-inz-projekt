namespace TeamUp.Api.DTOs;

public class CreateUserRequest
{
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? Description { get; set; }
    public string? PhotoUrl { get; set; }
    public string? FavoriteCategory { get; set; }
    public string? PreferenceGender { get; set; }
    public int? PreferenceAgeMin { get; set; }
    public int? PreferenceAgeMax { get; set; }
    public List<string>? FavoriteGames { get; set; }
    public List<string>? OtherGames { get; set; }
    public List<string>? Languages { get; set; }
    public List<string>? PreferenceCategories { get; set; }
    public List<string>? PreferenceLanguages { get; set; }
}

public class UpdateInteractionsRequest
{
    public List<string> LikedIds { get; set; } = new();
    public List<string> DislikedIds { get; set; } = new();
    public bool Replace { get; set; } = true;
    public bool RemoveConflicts { get; set; } = true;
}

public class PurgeInteractionsRequest
{
    public string TargetUserId { get; set; } = string.Empty;
    public bool RemoveFromLiked { get; set; } = true;
    public bool RemoveFromDisliked { get; set; } = true;
}
