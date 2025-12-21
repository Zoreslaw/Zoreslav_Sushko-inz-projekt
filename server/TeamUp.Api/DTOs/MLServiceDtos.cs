namespace TeamUp.Api.DTOs;

public class MLRecommendationRequest
{
    public UserProfile TargetUser { get; set; } = null!;
    public List<UserProfile> Candidates { get; set; } = new();
    public int TopK { get; set; } = 10;
    public string? Mode { get; set; }
    public string? FilterMode { get; set; }
    public List<string>? TargetLikedIds { get; set; }
    public List<string>? TargetDislikedIds { get; set; }
}

public class UserProfile
{
    public string Id { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public List<string> Games { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public string? FavoriteCategory { get; set; }
    public List<string> PreferenceCategories { get; set; } = new();
    public List<string> PreferenceLanguages { get; set; } = new();
    public List<string> OtherGames { get; set; } = new();
    public List<string> SteamGames { get; set; } = new();
    public List<string> SteamCategories { get; set; } = new();
    public string? PreferenceGender { get; set; }
    public int? PreferenceAgeMin { get; set; }
    public int? PreferenceAgeMax { get; set; }
}

public class MLRecommendationResponse
{
    public List<RecommendationResult> Results { get; set; } = new();
    public string ModelVersion { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public int ProcessingTimeMs { get; set; }
    public int TotalCandidates { get; set; }
}

public class RecommendationResult
{
    public string UserId { get; set; } = string.Empty;
    public double Score { get; set; }
}

public class RecommendationWithUser
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public List<string> FavoriteGames { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public double MatchScore { get; set; }
    public int MatchPercentage { get; set; }
}


