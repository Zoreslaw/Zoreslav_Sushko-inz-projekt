using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class HybridRecommendationService
{
    private readonly MLServiceClient _mlServiceClient;
    private readonly CBServiceClient _cbServiceClient;
    private readonly HybridRecommendationOptions _options;
    private readonly ILogger<HybridRecommendationService> _logger;

    public HybridRecommendationService(
        MLServiceClient mlServiceClient,
        CBServiceClient cbServiceClient,
        IOptions<HybridRecommendationOptions> options,
        ILogger<HybridRecommendationService> logger)
    {
        _mlServiceClient = mlServiceClient;
        _cbServiceClient = cbServiceClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<MLRecommendationResponse?> GetRecommendationsAsync(
        User targetUser,
        List<User> candidates,
        int topK)
    {
        var stopwatch = Stopwatch.StartNew();

        var candidatePool = ApplyCandidatePoolLimit(targetUser, candidates);

        MLRecommendationResponse? mlResponse = null;
        MLRecommendationResponse? cbResponse = null;

        try
        {
            mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                targetUser,
                candidatePool,
                topK: candidatePool.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Two-Tower service failed for user {UserId}", targetUser.Id);
        }

        try
        {
            cbResponse = await _cbServiceClient.GetRecommendationsAsync(
                targetUser,
                candidatePool,
                topK: candidatePool.Count,
                mode: "feedback",
                filterMode: "relaxed",
                targetLikedIds: targetUser.Liked,
                targetDislikedIds: targetUser.Disliked);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Content-based service failed for user {UserId}", targetUser.Id);
        }

        var mlScores = NormalizeScores(mlResponse, _options.MissingValueNeutralScore);
        var cbScores = NormalizeScores(cbResponse, _options.MissingValueNeutralScore);

        var weights = ResolveWeights(mlResponse != null, cbResponse != null);

        var scored = candidatePool.Select(candidate =>
        {
            var ttScore = mlScores.TryGetValue(candidate.Id, out var tt) ? tt : _options.MissingValueNeutralScore;
            var cbScore = cbScores.TryGetValue(candidate.Id, out var cb) ? cb : _options.MissingValueNeutralScore;
            var prefScore = ComputePreferenceScore(targetUser, candidate, _options);
            var interactionScore = ComputeInteractionScore(targetUser, candidate, _options);

            var blended = (weights.TwoTower * ttScore) +
                          (weights.Content * cbScore) +
                          (weights.Preference * prefScore) +
                          (weights.Interaction * interactionScore);

            return new { candidate.Id, Score = blended };
        })
        .OrderByDescending(x => x.Score)
        .Take(topK)
        .Select(x => new RecommendationResult { UserId = x.Id, Score = x.Score })
        .ToList();

        stopwatch.Stop();

        return new MLRecommendationResponse
        {
            Results = scored,
            ModelVersion = "hybrid-v1",
            Timestamp = DateTime.UtcNow.ToString("O"),
            ProcessingTimeMs = (int)stopwatch.ElapsedMilliseconds,
            TotalCandidates = candidatePool.Count
        };
    }

    private (double TwoTower, double Content, double Preference, double Interaction) ResolveWeights(
        bool hasTwoTower,
        bool hasContent)
    {
        var tt = hasTwoTower ? _options.TwoTowerWeight : 0.0;
        var cb = hasContent ? _options.ContentWeight : 0.0;
        var pref = _options.PreferenceWeight;
        var inter = _options.InteractionWeight;

        var total = tt + cb + pref + inter;
        if (total <= 0)
        {
            return (0, 0, 0, 0);
        }

        return (tt / total, cb / total, pref / total, inter / total);
    }

    private static Dictionary<string, double> NormalizeScores(
        MLRecommendationResponse? response,
        double neutralScore)
    {
        if (response?.Results == null || response.Results.Count == 0)
        {
            return new Dictionary<string, double>();
        }

        var scores = response.Results.ToDictionary(r => r.UserId, r => r.Score);
        var min = scores.Values.Min();
        var max = scores.Values.Max();

        if (Math.Abs(max - min) < 1e-9)
        {
            return scores.ToDictionary(kvp => kvp.Key, _ => neutralScore);
        }

        var range = max - min;
        return scores.ToDictionary(kvp => kvp.Key, kvp => (kvp.Value - min) / range);
    }

    private static double ComputePreferenceScore(
        User target,
        User candidate,
        HybridRecommendationOptions options)
    {
        var ageScore = Average(
            ScoreAge(target, candidate, options),
            ScoreAge(candidate, target, options));

        var genderScore = Average(
            ScoreGender(target, candidate, options),
            ScoreGender(candidate, target, options));

        var categoryScore = Average(
            ScoreOverlap(target.PreferenceCategories, GetCandidateCategories(candidate), options),
            ScoreOverlap(candidate.PreferenceCategories, GetCandidateCategories(target), options));

        var languageScore = Average(
            ScoreOverlap(target.PreferenceLanguages, candidate.Languages, options),
            ScoreOverlap(candidate.PreferenceLanguages, target.Languages, options));

        return Average(Average(ageScore, genderScore), Average(categoryScore, languageScore));
    }

    private static double ScoreAge(User target, User candidate, HybridRecommendationOptions options)
    {
        if (target.PreferenceAgeMin == null && target.PreferenceAgeMax == null)
        {
            return options.MissingValueNeutralScore;
        }

        var min = target.PreferenceAgeMin;
        var max = target.PreferenceAgeMax;
        var age = candidate.Age;

        var diff = 0;
        if (min.HasValue && age < min.Value)
        {
            diff = min.Value - age;
        }
        else if (max.HasValue && age > max.Value)
        {
            diff = age - max.Value;
        }

        if (diff <= 0)
        {
            return 1.0;
        }

        if (options.AgeSlackYears <= 0)
        {
            return 0.0;
        }

        return Math.Max(0.0, 1.0 - diff / (double)options.AgeSlackYears);
    }

    private static double ScoreGender(User target, User candidate, HybridRecommendationOptions options)
    {
        if (string.IsNullOrWhiteSpace(target.PreferenceGender) ||
            target.PreferenceGender.Equals("Any", StringComparison.OrdinalIgnoreCase))
        {
            return options.MissingValueNeutralScore;
        }

        if (string.IsNullOrWhiteSpace(candidate.Gender))
        {
            return options.MissingValueNeutralScore;
        }

        return target.PreferenceGender.Equals(candidate.Gender, StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
    }

    private static double ComputeInteractionScore(
        User target,
        User candidate,
        HybridRecommendationOptions options)
    {
        if (candidate.Liked.Contains(target.Id))
        {
            return 1.0;
        }

        if (candidate.Disliked.Contains(target.Id))
        {
            return 0.0;
        }

        return options.MissingValueNeutralScore;
    }

    private static double ScoreOverlap(
        IEnumerable<string> desired,
        IEnumerable<string> available,
        HybridRecommendationOptions options)
    {
        var desiredSet = NormalizeSet(desired);
        var availableSet = NormalizeSet(available);

        if (desiredSet.Count == 0 || availableSet.Count == 0)
        {
            return options.MissingValueNeutralScore;
        }

        var overlap = desiredSet.Intersect(availableSet).Count();
        return overlap / (double)desiredSet.Count;
    }

    private static HashSet<string> NormalizeSet(IEnumerable<string>? values)
    {
        if (values == null)
        {
            return new HashSet<string>();
        }

        return values
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v.Trim().ToLowerInvariant())
            .ToHashSet();
    }

    private static IEnumerable<string> GetCandidateCategories(User user)
    {
        var categories = new List<string>();
        if (!string.IsNullOrWhiteSpace(user.FavoriteCategory))
        {
            categories.Add(user.FavoriteCategory);
        }
        categories.AddRange(user.PreferenceCategories);
        categories.AddRange(user.SteamCategories);
        return categories;
    }

    private static double Average(double a, double b) => (a + b) / 2.0;

    private List<User> ApplyCandidatePoolLimit(User targetUser, List<User> candidates)
    {
        if (_options.MaxCandidatePool <= 0 || candidates.Count <= _options.MaxCandidatePool)
        {
            return candidates;
        }

        _logger.LogInformation(
            "Hybrid candidate pool trimmed for user {UserId}: {OriginalCount} -> {TrimmedCount}",
            targetUser.Id,
            candidates.Count,
            _options.MaxCandidatePool);

        return candidates
            .OrderBy(c => StableHash($"{targetUser.Id}:{c.Id}"))
            .Take(_options.MaxCandidatePool)
            .ToList();
    }

    private static int StableHash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return BitConverter.ToInt32(bytes, 0);
    }
}
