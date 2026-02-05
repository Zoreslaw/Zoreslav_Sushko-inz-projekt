using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamUp.Api.Models;

[Table("device_tokens")]
public class DeviceToken
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("user_id")]
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Column("token")]
    [Required]
    [MaxLength(300)]
    public string Token { get; set; } = string.Empty;

    [Column("platform")]
    [MaxLength(20)]
    public string Platform { get; set; } = "unknown";

    [Column("device_id")]
    [MaxLength(100)]
    public string? DeviceId { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_used_at")]
    public DateTime? LastUsedAt { get; set; }

    [ForeignKey("UserId")]
    public virtual User? User { get; set; }
}
