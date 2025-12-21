using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class PushNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(
        ApplicationDbContext context,
        HttpClient httpClient,
        ILogger<PushNotificationService> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task SendToUserAsync(string userId, string title, string body, Dictionary<string, string>? data = null)
    {
        List<DeviceToken> tokens;
        
        try
        {
            tokens = await _context.DeviceTokens
                .Where(t => t.UserId == userId && t.IsActive)
                .ToListAsync();

            if (tokens.Count == 0)
            {
                return;
            }
        }
        catch (Exception ex)
        {
            // Handle case where device_tokens table doesn't exist yet
            // This can happen if migrations haven't been run
            _logger.LogWarning(ex, "Failed to query device tokens. Table may not exist. Push notification skipped.");
            return;
        }

        var messages = tokens.Select(token => new ExpoPushMessage
        {
            To = token.Token,
            Title = title,
            Body = body,
            Data = data ?? new Dictionary<string, string>()
        }).ToList();

        try
        {
            var response = await _httpClient.PostAsJsonAsync("push/send", messages);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Expo push failed with status {StatusCode}", response.StatusCode);
                return;
            }

            var payload = await response.Content.ReadFromJsonAsync<ExpoPushResponse>();
            if (payload?.Data == null || payload.Data.Count == 0)
            {
                return;
            }

            for (var i = 0; i < payload.Data.Count && i < tokens.Count; i++)
            {
                var result = payload.Data[i];
                if (result.Status == "error" && result.Details?.Error == "DeviceNotRegistered")
                {
                    tokens[i].IsActive = false;
                }

                tokens[i].LastUsedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification");
        }
    }

    private class ExpoPushMessage
    {
        [JsonPropertyName("to")]
        public string To { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("body")]
        public string Body { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public Dictionary<string, string> Data { get; set; } = new();
    }

    private class ExpoPushResponse
    {
        [JsonPropertyName("data")]
        public List<ExpoPushResult> Data { get; set; } = new();
    }

    private class ExpoPushResult
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("details")]
        public ExpoPushErrorDetails? Details { get; set; }
    }

    private class ExpoPushErrorDetails
    {
        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}
