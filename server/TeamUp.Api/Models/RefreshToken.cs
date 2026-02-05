using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamUp.Api.Models;

[Table("refresh_tokens")]
public class RefreshToken
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("user_id")]
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Column("token")]
    [Required]
    [MaxLength(500)]
    public string Token { get; set; } = string.Empty;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    [Column("replaced_by_token")]
    [MaxLength(500)]
    public string? ReplacedByToken { get; set; }

    [NotMapped]
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

    [NotMapped]
    public bool IsRevoked => RevokedAt != null;

    [NotMapped]
    public bool IsActive => !IsRevoked && !IsExpired;

    // Navigation
    [ForeignKey("UserId")]
    public virtual User? User { get; set; }
}














