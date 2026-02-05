using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamUp.Api.Models;

[Table("conversations")]
public class Conversation
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("initiated_by")]
    [Required]
    public string InitiatedBy { get; set; } = string.Empty;

    [Column("initiated_at")]
    public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_updated_at")]
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();
    
    // Last message denormalized for quick access
    [Column("last_message_text")]
    [MaxLength(500)]
    public string? LastMessageText { get; set; }

    [Column("last_message_sender_id")]
    public string? LastMessageSenderId { get; set; }

    [Column("last_message_timestamp")]
    public DateTime? LastMessageTimestamp { get; set; }
}

[Table("conversation_participants")]
public class ConversationParticipant
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("conversation_id")]
    [Required]
    public string ConversationId { get; set; } = string.Empty;

    [Column("user_id")]
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Column("joined_at")]
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    [Column("last_read_at")]
    public DateTime? LastReadAt { get; set; }

    // Navigation properties
    [ForeignKey("ConversationId")]
    public virtual Conversation? Conversation { get; set; }

    [ForeignKey("UserId")]
    public virtual User? User { get; set; }
}

















