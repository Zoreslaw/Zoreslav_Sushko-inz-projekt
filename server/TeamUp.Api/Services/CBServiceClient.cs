using System.Text;
using System.Text.Json;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class CBServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<CBServiceClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public CBServiceClient(HttpClient httpClient, ILogger<CBServiceClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<MLRecommendationResponse?> GetRecommendationsAsync(
        User targetUser, 
        List<User> candidates, 
        int topK = 10)
    {
        try
        {
            var request = new MLRecommendationRequest
            {
                TargetUser = MapToUserProfile(targetUser),
                Candidates = candidates.Select(MapToUserProfile).ToList(),
                TopK = topK
            };

            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _logger.LogInformation(
                "Sending recommendation request to CB Service for user {UserId} with {CandidateCount} candidates",
                targetUser.Id, candidates.Count);

            var response = await _httpClient.PostAsync("/ml/recommend", content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError(
                    "CB Service returned {StatusCode}: {Error}",
                    response.StatusCode, errorContent);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<MLRecommendationResponse>(responseJson, JsonOptions);

            _logger.LogInformation(
                "Received {ResultCount} recommendations from CB Service in {ProcessingTime}ms",
                result?.Results.Count ?? 0, result?.ProcessingTimeMs ?? 0);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling CB Service");
            return null;
        }
    }

    public async Task<bool> HealthCheckAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/health");
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CB Service health check failed");
            return false;
        }
    }

    private static UserProfile MapToUserProfile(User user)
    {
        return new UserProfile
        {
            Id = user.Id,
            Age = user.Age,
            Gender = user.Gender,
            Games = user.FavoriteGames,
            Languages = user.Languages
        };
    }
}

