using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.Models;
using System.Collections.Generic;

namespace TeamUp.Api.Services;

/// <summary>
/// Service for calculating recommendation evaluation metrics.
/// </summary>
public class MetricsService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MetricsService> _logger;

    public MetricsService(ApplicationDbContext context, ILogger<MetricsService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all mutual accepts (matches) - pairs where both users liked each other.
    /// </summary>
    public HashSet<string> GetMutualAccepts(string userId)
    {
        var user = _context.Users.Find(userId);
        if (user == null)
            return new HashSet<string>();

        var mutualAccepts = new HashSet<string>();
        foreach (var likedId in user.Liked)
        {
            var otherUser = _context.Users.Find(likedId);
            if (otherUser != null && otherUser.Liked.Contains(userId))
            {
                mutualAccepts.Add(likedId);
            }
        }
        return mutualAccepts;
    }

    /// <summary>
    /// Get all users that the given user has started a chat with.
    /// For now, we consider a chat started if there's a mutual accept.
    /// TODO: Integrate with Firestore or add chat tracking to backend.
    /// </summary>
    public HashSet<string> GetChatStarts(string userId)
    {
        // Use messages as ground-truth chat starts when available.
        // If messages are stored elsewhere (e.g., Firestore), this should be integrated.
        return _context.Messages
            .Where(m => m.SenderId == userId || m.RecipientId == userId)
            .Select(m => m.SenderId == userId ? m.RecipientId : m.SenderId)
            .Distinct()
            .ToHashSet();
    }

    /// <summary>
    /// Get ground truth (relevant items) - users that the target user liked.
    /// </summary>
    public HashSet<string> GetGroundTruth(string userId)
    {
        var user = _context.Users.Find(userId);
        if (user == null)
            return new HashSet<string>();

        return new HashSet<string>(user.Liked);
    }

    /// <summary>
    /// Calculate metrics for a user's recommendations.
    /// </summary>
    public RecommendationMetrics CalculateMetrics(
        string userId,
        List<string> recommendedUserIds,
        List<int> kValues)
    {
        var groundTruth = GetGroundTruth(userId);
        var mutualAccepts = GetMutualAccepts(userId);
        var chatStarts = GetChatStarts(userId);
        return CalculateMetricsWithGroundTruth(userId, recommendedUserIds, groundTruth, kValues, mutualAccepts, chatStarts);
    }

    /// <summary>
    /// Calculate metrics with custom ground truth (for holdout evaluation).
    /// </summary>
    public RecommendationMetrics CalculateMetricsWithGroundTruth(
        string userId,
        List<string> recommendedUserIds,
        HashSet<string> groundTruth,
        List<int> kValues,
        HashSet<string>? mutualAccepts = null,
        HashSet<string>? chatStarts = null)
    {
        if (mutualAccepts == null)
            mutualAccepts = GetMutualAccepts(userId);
        if (chatStarts == null)
            chatStarts = GetChatStarts(userId);

        var normalizedRecommendations = NormalizeRecommendations(recommendedUserIds);

        var metrics = new RecommendationMetrics
        {
            UserId = userId,
            Algorithm = "", // Will be set by caller
            Timestamp = DateTime.UtcNow,
            KValues = kValues
        };

        foreach (var k in kValues)
        {
            var effectiveK = Math.Min(k, normalizedRecommendations.Count);
            var topK = normalizedRecommendations.Take(effectiveK).ToList();
            var topKSet = new HashSet<string>(topK);

            // Precision@K
            var relevantInTopK = topK.Count(uid => groundTruth.Contains(uid));
            metrics.PrecisionAtK[k] = effectiveK > 0 ? (double)relevantInTopK / effectiveK : 0.0;

            // Recall@K - ensure it never exceeds 100%
            // This can happen if there are duplicates or calculation errors
            var recall = groundTruth.Count > 0 
                ? (double)relevantInTopK / groundTruth.Count 
                : 0.0;
            metrics.RecallAtK[k] = Math.Min(1.0, recall); // Cap at 100%

            // NDCG@K
            metrics.NDCGAtK[k] = CalculateNDCG(normalizedRecommendations, groundTruth, k);

            // Hit Rate@K
            metrics.HitRateAtK[k] = groundTruth.Count > 0 && topKSet.Overlaps(groundTruth) ? 1.0 : 0.0;

            // Mutual Accept Rate@K - only count mutual accepts that are in ground truth
            var mutualInTopK = topKSet.Intersect(mutualAccepts).Intersect(groundTruth).Count();
            metrics.MutualAcceptRateAtK[k] = effectiveK > 0 ? (double)mutualInTopK / effectiveK : 0.0;

            // Chat Start Rate@K - only count chat starts that are in ground truth
            var chatInTopK = topKSet.Intersect(chatStarts).Intersect(groundTruth).Count();
            metrics.ChatStartRateAtK[k] = effectiveK > 0 ? (double)chatInTopK / effectiveK : 0.0;
        }

        return metrics;
    }

    private static List<string> NormalizeRecommendations(IEnumerable<string> recommendedUserIds)
    {
        var seen = new HashSet<string>();
        var normalized = new List<string>();
        foreach (var userId in recommendedUserIds)
        {
            if (string.IsNullOrWhiteSpace(userId))
                continue;
            if (seen.Add(userId))
                normalized.Add(userId);
        }
        return normalized;
    }

    private double CalculateNDCG(List<string> ranking, HashSet<string> relevant, int k)
    {
        if (relevant.Count == 0)
            return 0.0;

        // DCG@K
        double dcg = 0.0;
        for (int i = 0; i < Math.Min(k, ranking.Count); i++)
        {
            if (relevant.Contains(ranking[i]))
            {
                dcg += 1.0 / Math.Log2(i + 2); // i+2 because log2(1) = 0
            }
        }

        // IDCG@K (ideal: all relevant items ranked first)
        double idcg = 0.0;
        int relevantCount = Math.Min(relevant.Count, k);
        for (int i = 0; i < relevantCount; i++)
        {
            idcg += 1.0 / Math.Log2(i + 2);
        }

        return idcg > 0 ? dcg / idcg : 0.0;
    }
}

public class RecommendationMetrics
{
    public string UserId { get; set; } = string.Empty;
    public string Algorithm { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public List<int> KValues { get; set; } = new();
    public Dictionary<int, double> PrecisionAtK { get; set; } = new();
    public Dictionary<int, double> RecallAtK { get; set; } = new();
    public Dictionary<int, double> NDCGAtK { get; set; } = new();
    public Dictionary<int, double> HitRateAtK { get; set; } = new();
    public Dictionary<int, double> MutualAcceptRateAtK { get; set; } = new();
    public Dictionary<int, double> ChatStartRateAtK { get; set; } = new();
}
