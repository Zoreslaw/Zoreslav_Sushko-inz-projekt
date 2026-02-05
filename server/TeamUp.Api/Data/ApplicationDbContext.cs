using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Models;

namespace TeamUp.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserPresence> UserPresences { get; set; }
    public DbSet<DeviceToken> DeviceTokens { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => new { e.AuthProvider, e.ProviderId });
        });

        // Conversation configuration
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LastUpdatedAt);
        });

        // ConversationParticipant configuration
        modelBuilder.Entity<ConversationParticipant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ConversationId);
            entity.HasIndex(e => new { e.ConversationId, e.UserId }).IsUnique();
            
            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.Participants)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                .WithMany(u => u.ConversationParticipants)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Message configuration
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ConversationId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.ConversationId, e.Timestamp });

            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // RefreshToken configuration
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token);
            entity.HasIndex(e => e.UserId);

            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // DeviceToken configuration
        modelBuilder.Entity<DeviceToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.UserId);

            entity.HasOne(e => e.User)
                .WithMany(u => u.DeviceTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // UserPresence configuration
        modelBuilder.Entity<UserPresence>(entity =>
        {
            entity.HasKey(e => e.UserId);
            
            entity.HasOne(e => e.User)
                .WithOne(u => u.Presence)
                .HasForeignKey<UserPresence>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
