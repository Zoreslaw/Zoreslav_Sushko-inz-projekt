using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TeamUp.Api.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("display_name")]
    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    [Column("email")]
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Column("password_hash")]
    [MaxLength(500)]
    [JsonIgnore]
    public string? PasswordHash { get; set; }

    [Column("auth_provider")]
    [MaxLength(50)]
    public string AuthProvider { get; set; } = "Email"; // Email, Google, Apple

    [Column("provider_id")]
    [MaxLength(255)]
    public string? ProviderId { get; set; } // External provider user ID

    [Column("age")]
    [Range(18, 100)]
    public int Age { get; set; }

    [Column("gender")]
    [Required]
    [MaxLength(50)]
    public string Gender { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(500)]
    public string? Description { get; set; }

    [Column("photo_url")]
    [MaxLength(1000)]
    public string? PhotoUrl { get; set; }

    [Column("favorite_category")]
    [MaxLength(100)]
    public string? FavoriteCategory { get; set; }

    [Column("preference_gender")]
    [MaxLength(50)]
    public string? PreferenceGender { get; set; }

    [Column("preference_age_min")]
    [Range(18, 100)]
    public int? PreferenceAgeMin { get; set; }

    [Column("preference_age_max")]
    [Range(18, 100)]
    public int? PreferenceAgeMax { get; set; }

    [Column("favorite_games")]
    public List<string> FavoriteGames { get; set; } = new();

    [Column("other_games")]
    public List<string> OtherGames { get; set; } = new();

    [Column("languages")]
    public List<string> Languages { get; set; } = new();

    [Column("preference_categories")]
    public List<string> PreferenceCategories { get; set; } = new();

    [Column("preference_languages")]
    public List<string> PreferenceLanguages { get; set; } = new();

    [Column("steam_id")]
    [MaxLength(50)]
    public string? SteamId { get; set; }

    [Column("steam_display_name")]
    [MaxLength(100)]
    public string? SteamDisplayName { get; set; }

    [Column("steam_profile_url")]
    [MaxLength(500)]
    public string? SteamProfileUrl { get; set; }

    [Column("steam_avatar_url")]
    [MaxLength(500)]
    public string? SteamAvatarUrl { get; set; }

    [Column("steam_games")]
    public List<string> SteamGames { get; set; } = new();

    [Column("steam_categories")]
    public List<string> SteamCategories { get; set; } = new();

    [Column("steam_last_synced_at")]
    public DateTime? SteamLastSyncedAt { get; set; }

    [Column("liked")]
    public List<string> Liked { get; set; } = new();

    [Column("disliked")]
    public List<string> Disliked { get; set; } = new();

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [JsonIgnore]
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    [JsonIgnore]
    public virtual ICollection<DeviceToken> DeviceTokens { get; set; } = new List<DeviceToken>();
    
    [JsonIgnore]
    public virtual ICollection<ConversationParticipant> ConversationParticipants { get; set; } = new List<ConversationParticipant>();
    
    [JsonIgnore]
    public virtual UserPresence? Presence { get; set; }
}
