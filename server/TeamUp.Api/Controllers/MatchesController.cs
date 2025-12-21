using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;
using TeamUp.Api.Services;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MatchesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MatchesController> _logger;
    private readonly MLServiceClient _mlServiceClient;
    private readonly CBServiceClient _cbServiceClient;
    private readonly AlgorithmService _algorithmService;
    private readonly HybridRecommendationService _hybridRecommendationService;
    private readonly PushNotificationService _pushNotificationService;

    public MatchesController(
        ApplicationDbContext context,
        ILogger<MatchesController> logger,
        MLServiceClient mlServiceClient,
        CBServiceClient cbServiceClient,
        AlgorithmService algorithmService,
        HybridRecommendationService hybridRecommendationService,
        PushNotificationService pushNotificationService)
    {
        _context = context;
        _logger = logger;
        _mlServiceClient = mlServiceClient;
        _cbServiceClient = cbServiceClient;
        _algorithmService = algorithmService;
        _hybridRecommendationService = hybridRecommendationService;
        _pushNotificationService = pushNotificationService;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Get potential matches for the current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MatchResponse>>> GetMatches([FromQuery] int limit = 50)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var currentUser = await _context.Users.FindAsync(userId);
        if (currentUser == null)
            return NotFound(new { error = "User not found" });

        // Get candidates (exclude already liked/disliked)
        var excludeIds = currentUser.Liked.Concat(currentUser.Disliked).Append(userId).ToList();
        
        var candidates = await _context.Users
            .Where(u => !excludeIds.Contains(u.Id))
            .Where(u => !string.IsNullOrEmpty(u.Gender))
            .ToListAsync();

        // Soft-filter: only exclude candidates who explicitly disliked current user
        var filteredCandidates = candidates
            .Where(candidate => !candidate.Disliked.Contains(userId))
            .ToList();

        if (!filteredCandidates.Any())
        {
            return Ok(new List<MatchResponse>());
        }

        // Try to get ML recommendations
        var algorithm = _algorithmService.GetCurrentAlgorithm();
        List<MatchResponse> result;

        try
        {
            MLRecommendationResponse? mlResponse = null;

            if (algorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
            {
                mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                    currentUser,
                    filteredCandidates,
                    limit,
                    mode: "feedback",
                    filterMode: "strict",
                    targetLikedIds: currentUser.Liked,
                    targetDislikedIds: currentUser.Disliked);
            }
            else if (algorithm.Equals("Hybrid", StringComparison.OrdinalIgnoreCase))
            {
                mlResponse = await _hybridRecommendationService.GetRecommendationsAsync(
                    currentUser,
                    filteredCandidates,
                    limit);
            }
            else
            {
                mlResponse = await _mlServiceClient.GetRecommendationsAsync(currentUser, filteredCandidates, limit);
            }

            if (mlResponse != null && mlResponse.Results.Any())
            {
                result = mlResponse.Results.Select(r =>
                {
                    var candidate = filteredCandidates.FirstOrDefault(c => c.Id == r.UserId);
                    if (candidate == null) return null;

                    return new MatchResponse
                    {
                        Id = candidate.Id,
                        DisplayName = candidate.DisplayName,
                        PhotoUrl = candidate.PhotoUrl,
                        Age = candidate.Age,
                        Gender = candidate.Gender,
                        Description = candidate.Description,
                        FavoriteGames = candidate.FavoriteGames,
                        OtherGames = candidate.OtherGames,
                        Languages = candidate.Languages,
                        PreferenceCategories = candidate.PreferenceCategories,
                        Score = r.Score,
                        IsMatch = candidate.Liked.Contains(userId)
                    };
                }).Where(x => x != null).Cast<MatchResponse>().ToList();
            }
            else
            {
                // Fallback to basic matching
                result = await GetBasicMatches(currentUser, filteredCandidates, limit);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ML service unavailable, using basic matching");
            result = await GetBasicMatches(currentUser, filteredCandidates, limit);
        }

        _logger.LogInformation("Returning {Count} matches for user {UserId}", result.Count, userId);
        return Ok(result);
    }

    private Task<List<MatchResponse>> GetBasicMatches(User currentUser, List<User> candidates, int limit)
    {
        // Basic scoring algorithm (fallback when ML unavailable)
        var scored = candidates.Select(candidate =>
        {
            double score = 0;

            // Category synergy
            if (currentUser.PreferenceCategories.Any() && candidate.PreferenceCategories.Any())
            {
                score += candidate.PreferenceCategories
                    .Count(c => currentUser.PreferenceCategories.Contains(c)) * 10;
            }

            // Language overlap
            if (currentUser.Languages.Any() && candidate.Languages.Any())
            {
                score += currentUser.Languages
                    .Count(l => candidate.Languages.Contains(l)) * 5;
            }

            // Favorite games overlap
            if (currentUser.FavoriteGames.Any() && candidate.FavoriteGames.Any())
            {
                score += currentUser.FavoriteGames
                    .Count(g => candidate.FavoriteGames.Contains(g)) * 15;
            }

            // Other games overlap
            if (currentUser.OtherGames.Any() && candidate.OtherGames.Any())
            {
                score += currentUser.OtherGames
                    .Count(g => candidate.OtherGames.Contains(g)) * 10;
            }

            // Age proximity
            var ageDiff = Math.Abs(currentUser.Age - candidate.Age);
            if (ageDiff <= 2) score += 5;
            else if (ageDiff <= 5) score += 3;

            // Bonus if they already liked us
            if (candidate.Liked.Contains(currentUser.Id))
            {
                score += 30;
            }

            return new MatchResponse
            {
                Id = candidate.Id,
                DisplayName = candidate.DisplayName,
                PhotoUrl = candidate.PhotoUrl,
                Age = candidate.Age,
                Gender = candidate.Gender,
                Description = candidate.Description,
                FavoriteGames = candidate.FavoriteGames,
                OtherGames = candidate.OtherGames,
                Languages = candidate.Languages,
                PreferenceCategories = candidate.PreferenceCategories,
                Score = score,
                IsMatch = candidate.Liked.Contains(currentUser.Id)
            };
        })
        .OrderByDescending(m => m.Score)
        .Take(limit)
        .ToList();

        return Task.FromResult(scored);
    }

    /// <summary>
    /// Like a user (swipe right)
    /// </summary>
    [HttpPost("like")]
    public async Task<ActionResult<SwipeActionResponse>> LikeUser([FromBody] SwipeActionRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrEmpty(request.TargetUserId))
            return BadRequest(new { error = "Target user ID is required" });

        if (userId == request.TargetUserId)
            return BadRequest(new { error = "Cannot like yourself" });

        var currentUser = await _context.Users.FindAsync(userId);
        var targetUser = await _context.Users.FindAsync(request.TargetUserId);

        if (currentUser == null || targetUser == null)
            return NotFound(new { error = "User not found" });

        // Check if already liked
        if (currentUser.Liked.Contains(request.TargetUserId))
        {
            return Ok(new SwipeActionResponse
            {
                Success = true,
                IsMatch = targetUser.Liked.Contains(userId),
                Message = "Already liked"
            });
        }

        // Add to liked list
        currentUser.Liked.Add(request.TargetUserId);
        currentUser.UpdatedAt = DateTime.UtcNow;

        // Check if it's a match
        var isMatch = targetUser.Liked.Contains(userId);
        string? conversationId = null;

        if (isMatch)
        {
            // Create conversation if it doesn't exist
            var existingConversation = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId)
                .Select(cp => cp.ConversationId)
                .Intersect(
                    _context.ConversationParticipants
                        .Where(cp => cp.UserId == request.TargetUserId)
                        .Select(cp => cp.ConversationId)
                )
                .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(existingConversation))
            {
                var conversation = new Conversation
                {
                    InitiatedBy = userId,
                    InitiatedAt = DateTime.UtcNow,
                    LastUpdatedAt = DateTime.UtcNow
                };

                _context.Conversations.Add(conversation);

                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.Id,
                    UserId = userId,
                    JoinedAt = DateTime.UtcNow
                });

                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.Id,
                    UserId = request.TargetUserId,
                    JoinedAt = DateTime.UtcNow
                });

                conversationId = conversation.Id;
                _logger.LogInformation("Match! Created conversation {ConversationId} between {UserId} and {TargetUserId}",
                    conversationId, userId, request.TargetUserId);
            }
            else
            {
                conversationId = existingConversation;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} liked {TargetUserId}, Match: {IsMatch}", userId, request.TargetUserId, isMatch);

        if (isMatch)
        {
            await _pushNotificationService.SendToUserAsync(
                request.TargetUserId,
                "It's a match!",
                $"You matched with {currentUser.DisplayName}",
                new Dictionary<string, string>
                {
                    { "conversationId", conversationId ?? string.Empty },
                    { "matchedUserId", userId }
                });
        }

        return Ok(new SwipeActionResponse
        {
            Success = true,
            IsMatch = isMatch,
            ConversationId = conversationId,
            Message = isMatch ? "It's a match!" : "Liked"
        });
    }

    /// <summary>
    /// Dislike a user (swipe left)
    /// </summary>
    [HttpPost("dislike")]
    public async Task<ActionResult<SwipeActionResponse>> DislikeUser([FromBody] SwipeActionRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrEmpty(request.TargetUserId))
            return BadRequest(new { error = "Target user ID is required" });

        if (userId == request.TargetUserId)
            return BadRequest(new { error = "Cannot dislike yourself" });

        var currentUser = await _context.Users.FindAsync(userId);

        if (currentUser == null)
            return NotFound(new { error = "User not found" });

        // Check if already disliked
        if (currentUser.Disliked.Contains(request.TargetUserId))
        {
            return Ok(new SwipeActionResponse
            {
                Success = true,
                IsMatch = false,
                Message = "Already disliked"
            });
        }

        // Add to disliked list
        currentUser.Disliked.Add(request.TargetUserId);
        currentUser.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} disliked {TargetUserId}", userId, request.TargetUserId);

        return Ok(new SwipeActionResponse
        {
            Success = true,
            IsMatch = false,
            Message = "Passed"
        });
    }
}















