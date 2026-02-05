using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamUp.Api.Models;

[Table("messages")]
public class Message
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("conversation_id")]
    [Required]
    public string ConversationId { get; set; } = string.Empty;

    [Column("sender_id")]
    [Required]
    public string SenderId { get; set; } = string.Empty;

    [Column("recipient_id")]
    [Required]
    public string RecipientId { get; set; } = string.Empty;

    [Column("message_text")]
    [Required]
    [MaxLength(4000)]
    public string MessageText { get; set; } = string.Empty;

    [Column("message_type")]
    [MaxLength(50)]
    public string MessageType { get; set; } = "Text"; // Text, Image, Video, etc.

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "Sent"; // Sent, Delivered, Read

    [Column("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [Column("url")]
    [MaxLength(2000)]
    public string? Url { get; set; } // For media messages

    // Navigation properties
    [ForeignKey("ConversationId")]
    public virtual Conversation? Conversation { get; set; }

    [ForeignKey("SenderId")]
    public virtual User? Sender { get; set; }
}














