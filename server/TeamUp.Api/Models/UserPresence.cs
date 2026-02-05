using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamUp.Api.Models;

[Table("user_presence")]
public class UserPresence
{
    [Key]
    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [Column("is_online")]
    public bool IsOnline { get; set; } = false;

    [Column("last_seen_at")]
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    [Column("connection_id")]
    [MaxLength(100)]
    public string? ConnectionId { get; set; }

    // Navigation
    [ForeignKey("UserId")]
    public virtual User? User { get; set; }
}




















