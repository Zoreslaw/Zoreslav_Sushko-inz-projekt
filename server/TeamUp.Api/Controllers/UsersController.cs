using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using TeamUp.Api.Data;
using TeamUp.Api.DTOs;
using TeamUp.Api.Models;
using TeamUp.Api.Services;

namespace TeamUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UsersController> _logger;
    private readonly MLServiceClient _mlServiceClient;
    private readonly CBServiceClient _cbServiceClient;
    private readonly AlgorithmService _algorithmService;
    private readonly MetricsService _metricsService;
    private readonly CsvImportService _csvImportService;
    private const double DefaultHoldoutFraction = 0.2;
    private const int DefaultMaxUsers = 100;
    private const int DefaultMinLikesForEval = 5;
    private const int DefaultMinHoldoutSize = 2;
    private const string CandidateConstructionDescription =
        "eligible_by_preferences_excluding_self_disliked_and_non_holdout_likes";

    public UsersController(
        ApplicationDbContext context, 
        ILogger<UsersController> logger,
        MLServiceClient mlServiceClient,
        CBServiceClient cbServiceClient,
        AlgorithmService algorithmService,
        MetricsService metricsService,
        CsvImportService csvImportService)
    {
        _context = context;
        _logger = logger;
        _mlServiceClient = mlServiceClient;
        _cbServiceClient = cbServiceClient;
        _algorithmService = algorithmService;
        _metricsService = metricsService;
        _csvImportService = csvImportService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<User>>> GetAllUsers()
    {
        try
        {
            var users = await _context.Users.ToListAsync();
            _logger.LogInformation("Retrieved {Count} users", users.Count);
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<User>> GetUser(string id)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            
            if (user == null)
            {
                return NotFound(new { error = "User not found" });
            }

            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user {UserId}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("random")]
    public async Task<ActionResult<User>> CreateRandomUser()
    {
        try
        {
            var user = RandomUserGenerator.GenerateRandomUser();
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Created random user {UserId} - {DisplayName}", user.Id, user.DisplayName);
            
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating random user");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("random/bulk")]
    public async Task<ActionResult> CreateRandomUsers([FromQuery] int count = 10)
    {
        try
        {
            if (count < 1 || count > 100)
            {
                return BadRequest(new { error = "Count must be between 1 and 100" });
            }

            var users = new List<User>();
            for (int i = 0; i < count; i++)
            {
                users.Add(RandomUserGenerator.GenerateRandomUser());
            }
            
            _context.Users.AddRange(users);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Created {Count} random users", count);
            
            return Ok(new 
            { 
                message = $"Successfully created {count} random users",
                count = count,
                userIds = users.Select(u => u.Id).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating random users");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("algorithm")]
    public ActionResult<AlgorithmResponse> GetAlgorithm()
    {
        var algorithm = _algorithmService.GetCurrentAlgorithm();
        return Ok(new AlgorithmResponse
        {
            Algorithm = algorithm,
            Message = $"Current algorithm is {algorithm}"
        });
    }

    [HttpPost("algorithm")]
    public ActionResult<AlgorithmResponse> SetAlgorithm([FromBody] SetAlgorithmRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Algorithm))
        {
            return BadRequest(new { error = "Algorithm is required" });
        }

        var success = _algorithmService.SetAlgorithm(request.Algorithm);
        if (!success)
        {
            return BadRequest(new { error = "Invalid algorithm. Must be 'TwoTower' or 'ContentBased'" });
        }

        var currentAlgorithm = _algorithmService.GetCurrentAlgorithm();
        _logger.LogInformation("Algorithm set to {Algorithm}", currentAlgorithm);

        return Ok(new AlgorithmResponse
        {
            Algorithm = currentAlgorithm,
            Message = $"Algorithm successfully set to {currentAlgorithm}"
        });
    }

    [HttpPost("recommendations/{userId}")]
    public async Task<ActionResult<IEnumerable<RecommendationWithUser>>> GetRecommendations(
        string userId, 
        [FromQuery] int topK = 10)
    {
        try
        {
            var targetUser = await _context.Users.FindAsync(userId);
            if (targetUser == null)
            {
                return NotFound(new { error = "User not found" });
            }

            var candidates = await _context.Users
                .Where(u => u.Id != userId && 
                           !targetUser.Liked.Contains(u.Id) && 
                           !targetUser.Disliked.Contains(u.Id))
                .ToListAsync();

            if (candidates.Count == 0)
            {
                return Ok(new List<RecommendationWithUser>());
            }

            // Get the current algorithm from the service
            var algorithm = _algorithmService.GetCurrentAlgorithm();

            _logger.LogInformation(
                "Getting recommendations for user {UserId} from {CandidateCount} candidates using algorithm {Algorithm}",
                userId, candidates.Count, algorithm);

            MLRecommendationResponse? mlResponse = null;
            string serviceName = "";

            if (algorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
            {
                serviceName = "CB Service";
                mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                    targetUser, 
                    candidates, 
                    topK);
            }
            else
            {
                // Default to TwoTower (ML Service)
                serviceName = "ML Service";
                mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                targetUser, 
                candidates, 
                topK);
            }

            if (mlResponse == null)
            {
                return StatusCode(503, new 
                { 
                    error = $"{serviceName} unavailable",
                    message = $"Could not get recommendations from {serviceName}"
                });
            }

            var recommendationsWithUsers = new List<RecommendationWithUser>();
            
            foreach (var result in mlResponse.Results)
            {
                var user = candidates.FirstOrDefault(u => u.Id == result.UserId);
                if (user != null)
                {
                    recommendationsWithUsers.Add(new RecommendationWithUser
                    {
                        UserId = user.Id,
                        DisplayName = user.DisplayName,
                        Age = user.Age,
                        Gender = user.Gender,
                        PhotoUrl = user.PhotoUrl,
                        FavoriteGames = user.FavoriteGames,
                        Languages = user.Languages,
                        MatchScore = result.Score,
                        MatchPercentage = (int)Math.Round(result.Score * 100)
                    });
                }
            }

            _logger.LogInformation(
                "Returning {Count} recommendations for user {UserId}",
                recommendationsWithUsers.Count, userId);

            return Ok(recommendationsWithUsers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting recommendations for user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost("metrics/{userId}")]
    public async Task<ActionResult<MetricsResponse>> CalculateMetrics(
        string userId,
        [FromBody] MetricsRequest? request = null,
        [FromQuery] int minLikes = DefaultMinLikesForEval,
        [FromQuery] int minHoldoutSize = DefaultMinHoldoutSize)
    {
        try
        {
            var targetUser = await _context.Users.FindAsync(userId);
            if (targetUser == null)
            {
                return NotFound(new { error = "User not found" });
            }

            if (!HasCompleteProfile(targetUser))
            {
                return BadRequest(new { error = "User profile incomplete for metrics evaluation" });
            }

            if (targetUser.Liked.Count < minLikes)
            {
                return BadRequest(new { error = "Not enough liked interactions available for metrics calculation" });
            }

            var kValues = NormalizeKValues(request?.KValues);
            var algorithm = _algorithmService.GetCurrentAlgorithm();

            var allUsers = await _context.Users.ToListAsync();
            var eligibleCandidates = BuildEligibleCandidates(targetUser, allUsers);

            if (eligibleCandidates.Count == 0)
            {
                return BadRequest(new { error = "No eligible candidates available for metrics calculation" });
            }

            var eligibleCandidateIds = eligibleCandidates.Select(u => u.Id).ToHashSet();
            var eligibleLiked = targetUser.Liked
                .Where(id => eligibleCandidateIds.Contains(id) && !targetUser.Disliked.Contains(id))
                .Distinct()
                .ToList();

            if (eligibleLiked.Count < minLikes)
            {
                return BadRequest(new { error = "Not enough eligible liked users available for metrics calculation" });
            }

            var holdoutLiked = SelectHoldout(eligibleLiked, DefaultHoldoutFraction, minHoldoutSize, userId);
            var remainingLiked = eligibleLiked.Where(id => !holdoutLiked.Contains(id)).ToList();
            var eligibleLikedSet = eligibleLiked.ToHashSet();

            var candidatesForEval = eligibleCandidates
                .Where(u => !eligibleLikedSet.Contains(u.Id))
                .ToList();
            candidatesForEval.AddRange(eligibleCandidates.Where(u => holdoutLiked.Contains(u.Id)));
            candidatesForEval = candidatesForEval.DistinctBy(u => u.Id).ToList();

            if (candidatesForEval.Count == 0)
            {
                return BadRequest(new { error = "No evaluation candidates available after holdout construction" });
            }

            MLRecommendationResponse? mlResponse = null;
            if (algorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
            {
                mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                    targetUser,
                    candidatesForEval,
                    kValues.Max(),
                    mode: "feedback",
                    targetLikedIds: remainingLiked,
                    targetDislikedIds: targetUser.Disliked);
            }
            else
            {
                mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                    targetUser, candidatesForEval, kValues.Max());
            }

            if (mlResponse == null)
            {
                return StatusCode(503, new { error = "Recommendation service unavailable" });
            }

            var recommendedIds = mlResponse.Results.Select(r => r.UserId).ToList();
            var likesByUserId = BuildLikesByUserId(allUsers);
            var holdoutMutualAccepts = BuildHoldoutMutualAccepts(userId, holdoutLiked, likesByUserId);
            var chatPartners = await GetChatPartnersAsync(new[] { userId });
            var holdoutChatStarts = holdoutLiked
                .Where(id => chatPartners.TryGetValue(userId, out var partners) && partners.Contains(id))
                .ToHashSet();

            var metrics = _metricsService.CalculateMetricsWithGroundTruth(
                userId,
                recommendedIds,
                holdoutLiked,
                kValues,
                holdoutMutualAccepts,
                holdoutChatStarts);
            metrics.Algorithm = algorithm;

            var response = new MetricsResponse
            {
                UserId = metrics.UserId,
                Algorithm = metrics.Algorithm,
                Timestamp = metrics.Timestamp,
                PrecisionAtK = metrics.PrecisionAtK,
                RecallAtK = metrics.RecallAtK,
                NDCGAtK = metrics.NDCGAtK,
                HitRateAtK = metrics.HitRateAtK,
                MutualAcceptRateAtK = metrics.MutualAcceptRateAtK,
                ChatStartRateAtK = metrics.ChatStartRateAtK,
                Evaluation = new MetricsEvaluationMetadata
                {
                    HoldoutStrategy = "fraction",
                    HoldoutFraction = DefaultHoldoutFraction,
                    HoldoutSize = holdoutLiked.Count,
                    CandidateConstruction = CandidateConstructionDescription,
                    Aggregation = "per_user",
                    PrecisionDenominator = "min(k, rec_count)",
                    ChatStartDefinition = "any_message_between_pair",
                    UserSelection = "n/a",
                    MinLikesForEval = minLikes,
                    MinHoldoutSize = minHoldoutSize,
                    AverageHoldoutSize = holdoutLiked.Count,
                    AverageCandidateCount = candidatesForEval.Count,
                    AverageEligibleLikedCount = eligibleLiked.Count,
                    UsersConsidered = 1,
                    UsersSkipped = 0
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating metrics for user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("metrics/aggregate")]
    public async Task<ActionResult<AggregateMetricsResponse>> GetAggregateMetrics(
        [FromQuery] string? algorithm = null,
        [FromQuery] List<int>? kValues = null,
        [FromQuery] int maxUsers = DefaultMaxUsers,
        [FromQuery] int? sampleSeed = null,
        [FromQuery] int minLikes = DefaultMinLikesForEval,
        [FromQuery] int minHoldoutSize = DefaultMinHoldoutSize)
    {
        try
        {
            var currentAlgorithm = algorithm ?? _algorithmService.GetCurrentAlgorithm();
            var kVals = NormalizeKValues(kValues);
            maxUsers = Math.Clamp(maxUsers, 1, 500);

            var allUsers = await _context.Users.ToListAsync();
            var eligibleUsers = allUsers
                .Where(u => u.Liked.Count > 0 && HasCompleteProfile(u))
                .ToList();

            if (eligibleUsers.Count == 0)
            {
                return BadRequest(new { error = "No users with interactions and complete profiles found" });
            }

            var sampledUsers = SampleUsers(eligibleUsers, maxUsers, sampleSeed);
            var likesByUserId = BuildLikesByUserId(allUsers);
            var chatPartners = await GetChatPartnersAsync(sampledUsers.Select(u => u.Id));

            var allMetrics = new List<RecommendationMetrics>();
            var totalEligibleLiked = 0;
            var totalHoldout = 0;
            var totalCandidates = 0;
            var usersConsidered = 0;
            var usersSkipped = 0;

            foreach (var user in sampledUsers)
            {
                try
                {
                    usersConsidered++;
                    var eligibleCandidates = BuildEligibleCandidates(user, allUsers);
                    if (eligibleCandidates.Count == 0)
                    {
                        usersSkipped++;
                        continue;
                    }

                    var eligibleCandidateIds = eligibleCandidates.Select(u => u.Id).ToHashSet();
                    var eligibleLiked = user.Liked
                        .Where(id => eligibleCandidateIds.Contains(id) && !user.Disliked.Contains(id))
                        .Distinct()
                        .ToList();

                    if (eligibleLiked.Count < minLikes)
                    {
                        usersSkipped++;
                        continue;
                    }

                    var holdoutLiked = SelectHoldout(eligibleLiked, DefaultHoldoutFraction, minHoldoutSize, user.Id);
                    var remainingLiked = eligibleLiked.Where(id => !holdoutLiked.Contains(id)).ToList();
                    var eligibleLikedSet = eligibleLiked.ToHashSet();

                    var userCandidates = eligibleCandidates
                        .Where(u => !eligibleLikedSet.Contains(u.Id))
                        .ToList();
                    userCandidates.AddRange(eligibleCandidates.Where(u => holdoutLiked.Contains(u.Id)));
                    userCandidates = userCandidates.DistinctBy(u => u.Id).ToList();

                    if (userCandidates.Count == 0 || holdoutLiked.Count == 0)
                    {
                        usersSkipped++;
                        continue;
                    }

                    totalEligibleLiked += eligibleLiked.Count;
                    totalHoldout += holdoutLiked.Count;
                    totalCandidates += userCandidates.Count;

                    MLRecommendationResponse? mlResponse = null;
                    if (currentAlgorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
                    {
                        mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                            user,
                            userCandidates,
                            kVals.Max(),
                            mode: "feedback",
                            targetLikedIds: remainingLiked,
                            targetDislikedIds: user.Disliked);
                    }
                    else
                    {
                        mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                            user, userCandidates, kVals.Max());
                    }

                    if (mlResponse == null)
                    {
                        usersSkipped++;
                        continue;
                    }

                    var recommendedIds = mlResponse.Results.Select(r => r.UserId).ToList();
                    var holdoutMutualAccepts = BuildHoldoutMutualAccepts(user.Id, holdoutLiked, likesByUserId);
                    var holdoutChatStarts = holdoutLiked
                        .Where(id => chatPartners.TryGetValue(user.Id, out var partners) && partners.Contains(id))
                        .ToHashSet();

                    var metrics = _metricsService.CalculateMetricsWithGroundTruth(
                        user.Id, recommendedIds, holdoutLiked, kVals, holdoutMutualAccepts, holdoutChatStarts);
                    metrics.Algorithm = currentAlgorithm;
                    allMetrics.Add(metrics);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to calculate metrics for user {UserId}", user.Id);
                }
            }

            if (allMetrics.Count == 0)
            {
                return BadRequest(new { error = "Could not calculate metrics for any users" });
            }

            var avgHoldout = allMetrics.Count > 0 ? (double)totalHoldout / allMetrics.Count : 0.0;
            var avgCandidates = allMetrics.Count > 0 ? (double)totalCandidates / allMetrics.Count : 0.0;
            var avgEligibleLiked = allMetrics.Count > 0 ? (double)totalEligibleLiked / allMetrics.Count : 0.0;

            var aggregate = new AggregateMetricsResponse
            {
                Algorithm = currentAlgorithm,
                Timestamp = DateTime.UtcNow,
                UserCount = allMetrics.Count,
                Evaluation = new MetricsEvaluationMetadata
                {
                    HoldoutStrategy = "fraction",
                    HoldoutFraction = DefaultHoldoutFraction,
                    CandidateConstruction = CandidateConstructionDescription,
                    Aggregation = "macro",
                    PrecisionDenominator = "min(k, rec_count)",
                    ChatStartDefinition = "any_message_between_pair",
                    SampleSize = allMetrics.Count,
                    MaxUsersEvaluated = maxUsers,
                    UserSelection = sampleSeed.HasValue
                        ? $"deterministic_hash(seed={sampleSeed.Value})"
                        : "deterministic_hash(seed=0)",
                    MinLikesForEval = minLikes,
                    MinHoldoutSize = minHoldoutSize,
                    AverageHoldoutSize = avgHoldout,
                    AverageCandidateCount = avgCandidates,
                    AverageEligibleLikedCount = avgEligibleLiked,
                    UsersConsidered = usersConsidered,
                    UsersSkipped = usersSkipped
                }
            };

            foreach (var k in kVals)
            {
                aggregate.AvgPrecisionAtK[k] = allMetrics.Average(m => m.PrecisionAtK.GetValueOrDefault(k, 0.0));
                aggregate.AvgRecallAtK[k] = allMetrics.Average(m => m.RecallAtK.GetValueOrDefault(k, 0.0));
                aggregate.AvgNDCGAtK[k] = allMetrics.Average(m => m.NDCGAtK.GetValueOrDefault(k, 0.0));
                aggregate.AvgHitRateAtK[k] = allMetrics.Average(m => m.HitRateAtK.GetValueOrDefault(k, 0.0));
                aggregate.AvgMutualAcceptRateAtK[k] = allMetrics.Average(m => m.MutualAcceptRateAtK.GetValueOrDefault(k, 0.0));
                aggregate.AvgChatStartRateAtK[k] = allMetrics.Average(m => m.ChatStartRateAtK.GetValueOrDefault(k, 0.0));
            }

            return Ok(aggregate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating aggregate metrics");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Evaluate both algorithms on the same holdout set for fair comparison.
    /// This ensures both algorithms are evaluated on identical ground truth.
    /// </summary>
    [HttpGet("metrics/compare")]
    public async Task<ActionResult<Dictionary<string, AggregateMetricsResponse>>> CompareAlgorithms(
        [FromQuery] List<int>? kValues = null,
        [FromQuery] int maxUsers = DefaultMaxUsers,
        [FromQuery] int? sampleSeed = null,
        [FromQuery] int minLikes = DefaultMinLikesForEval,
        [FromQuery] int minHoldoutSize = DefaultMinHoldoutSize)
    {
        try
        {
            var kVals = NormalizeKValues(kValues);
            maxUsers = Math.Clamp(maxUsers, 1, 500);

            var allUsers = await _context.Users.ToListAsync();
            var eligibleUsers = allUsers
                .Where(u => u.Liked.Count > 0 && HasCompleteProfile(u))
                .ToList();

            if (eligibleUsers.Count == 0)
            {
                return BadRequest(new { error = "No users with interactions and complete profiles found" });
            }

            var sampledUsers = SampleUsers(eligibleUsers, maxUsers, sampleSeed);
            var likesByUserId = BuildLikesByUserId(allUsers);
            var chatPartners = await GetChatPartnersAsync(sampledUsers.Select(u => u.Id));
            var mlMetrics = new List<RecommendationMetrics>();
            var cbMetrics = new List<RecommendationMetrics>();
            var totalEligibleLiked = 0;
            var totalHoldout = 0;
            var totalCandidates = 0;
            var usersConsidered = 0;
            var usersSkipped = 0;

            foreach (var user in sampledUsers)
            {
                try
                {
                    usersConsidered++;
                    var eligibleCandidates = BuildEligibleCandidates(user, allUsers);
                    if (eligibleCandidates.Count == 0)
                    {
                        usersSkipped++;
                        continue;
                    }

                    var eligibleCandidateIds = eligibleCandidates.Select(u => u.Id).ToHashSet();
                    var eligibleLiked = user.Liked
                        .Where(id => eligibleCandidateIds.Contains(id) && !user.Disliked.Contains(id))
                        .Distinct()
                        .ToList();

                    if (eligibleLiked.Count < minLikes)
                    {
                        usersSkipped++;
                        continue;
                    }

                    var holdoutLiked = SelectHoldout(eligibleLiked, DefaultHoldoutFraction, minHoldoutSize, user.Id);
                    var remainingLiked = eligibleLiked.Where(id => !holdoutLiked.Contains(id)).ToList();
                    var eligibleLikedSet = eligibleLiked.ToHashSet();

                    var userCandidates = eligibleCandidates
                        .Where(u => !eligibleLikedSet.Contains(u.Id))
                        .ToList();
                    userCandidates.AddRange(eligibleCandidates.Where(u => holdoutLiked.Contains(u.Id)));
                    userCandidates = userCandidates.DistinctBy(u => u.Id).ToList();

                    if (userCandidates.Count == 0 || holdoutLiked.Count == 0)
                    {
                        usersSkipped++;
                        continue;
                    }

                    totalEligibleLiked += eligibleLiked.Count;
                    totalHoldout += holdoutLiked.Count;
                    totalCandidates += userCandidates.Count;

                    var holdoutMutualAccepts = BuildHoldoutMutualAccepts(user.Id, holdoutLiked, likesByUserId);
                    var holdoutChatStarts = holdoutLiked
                        .Where(id => chatPartners.TryGetValue(user.Id, out var partners) && partners.Contains(id))
                        .ToHashSet();

                    var mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                        user, userCandidates, kVals.Max());
                    if (mlResponse != null)
                    {
                        var mlRecommendedIds = mlResponse.Results.Select(r => r.UserId).ToList();
                        var mlMetricsForUser = _metricsService.CalculateMetricsWithGroundTruth(
                            user.Id, mlRecommendedIds, holdoutLiked, kVals, holdoutMutualAccepts, holdoutChatStarts);
                        mlMetricsForUser.Algorithm = "TwoTower";
                        mlMetrics.Add(mlMetricsForUser);
                    }

                    var cbResponse = await _cbServiceClient.GetRecommendationsAsync(
                        user,
                        userCandidates,
                        kVals.Max(),
                        mode: "feedback",
                        targetLikedIds: remainingLiked,
                        targetDislikedIds: user.Disliked);

                    if (cbResponse != null)
                    {
                        var cbRecommendedIds = cbResponse.Results.Select(r => r.UserId).ToList();
                        var cbMetricsForUser = _metricsService.CalculateMetricsWithGroundTruth(
                            user.Id, cbRecommendedIds, holdoutLiked, kVals, holdoutMutualAccepts, holdoutChatStarts);
                        cbMetricsForUser.Algorithm = "ContentBased";
                        cbMetrics.Add(cbMetricsForUser);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to calculate comparison metrics for user {UserId}", user.Id);
                }
            }

            var result = new Dictionary<string, AggregateMetricsResponse>();
            var avgHoldout = mlMetrics.Count > 0 ? (double)totalHoldout / mlMetrics.Count : 0.0;
            var avgCandidates = mlMetrics.Count > 0 ? (double)totalCandidates / mlMetrics.Count : 0.0;
            var avgEligibleLiked = mlMetrics.Count > 0 ? (double)totalEligibleLiked / mlMetrics.Count : 0.0;

            // Aggregate TwoTower metrics
            if (mlMetrics.Count > 0)
            {
                var mlAggregate = new AggregateMetricsResponse
                {
                    Algorithm = "TwoTower",
                    Timestamp = DateTime.UtcNow,
                    UserCount = mlMetrics.Count,
                    Evaluation = new MetricsEvaluationMetadata
                    {
                        HoldoutStrategy = "fraction",
                        HoldoutFraction = DefaultHoldoutFraction,
                        CandidateConstruction = CandidateConstructionDescription,
                        Aggregation = "macro",
                        PrecisionDenominator = "min(k, rec_count)",
                        ChatStartDefinition = "any_message_between_pair",
                        SampleSize = mlMetrics.Count,
                        MaxUsersEvaluated = maxUsers,
                        UserSelection = sampleSeed.HasValue
                            ? $"deterministic_hash(seed={sampleSeed.Value})"
                            : "deterministic_hash(seed=0)",
                        MinLikesForEval = minLikes,
                        MinHoldoutSize = minHoldoutSize,
                        AverageHoldoutSize = avgHoldout,
                        AverageCandidateCount = avgCandidates,
                        AverageEligibleLikedCount = avgEligibleLiked,
                        UsersConsidered = usersConsidered,
                        UsersSkipped = usersSkipped
                    }
                };

                foreach (var k in kVals)
                {
                    mlAggregate.AvgPrecisionAtK[k] = mlMetrics.Average(m => m.PrecisionAtK.GetValueOrDefault(k, 0.0));
                    mlAggregate.AvgRecallAtK[k] = mlMetrics.Average(m => m.RecallAtK.GetValueOrDefault(k, 0.0));
                    mlAggregate.AvgNDCGAtK[k] = mlMetrics.Average(m => m.NDCGAtK.GetValueOrDefault(k, 0.0));
                    mlAggregate.AvgHitRateAtK[k] = mlMetrics.Average(m => m.HitRateAtK.GetValueOrDefault(k, 0.0));
                    mlAggregate.AvgMutualAcceptRateAtK[k] = mlMetrics.Average(m => m.MutualAcceptRateAtK.GetValueOrDefault(k, 0.0));
                    mlAggregate.AvgChatStartRateAtK[k] = mlMetrics.Average(m => m.ChatStartRateAtK.GetValueOrDefault(k, 0.0));
                }

                result["TwoTower"] = mlAggregate;
            }

            // Aggregate ContentBased metrics
            if (cbMetrics.Count > 0)
            {
                var cbAggregate = new AggregateMetricsResponse
                {
                    Algorithm = "ContentBased",
                    Timestamp = DateTime.UtcNow,
                    UserCount = cbMetrics.Count,
                    Evaluation = new MetricsEvaluationMetadata
                    {
                        HoldoutStrategy = "fraction",
                        HoldoutFraction = DefaultHoldoutFraction,
                        CandidateConstruction = CandidateConstructionDescription,
                        Aggregation = "macro",
                        PrecisionDenominator = "min(k, rec_count)",
                        ChatStartDefinition = "any_message_between_pair",
                        SampleSize = cbMetrics.Count,
                        MaxUsersEvaluated = maxUsers,
                        UserSelection = sampleSeed.HasValue
                            ? $"deterministic_hash(seed={sampleSeed.Value})"
                            : "deterministic_hash(seed=0)",
                        MinLikesForEval = minLikes,
                        MinHoldoutSize = minHoldoutSize,
                        AverageHoldoutSize = avgHoldout,
                        AverageCandidateCount = avgCandidates,
                        AverageEligibleLikedCount = avgEligibleLiked,
                        UsersConsidered = usersConsidered,
                        UsersSkipped = usersSkipped
                    }
                };

                foreach (var k in kVals)
                {
                    cbAggregate.AvgPrecisionAtK[k] = cbMetrics.Average(m => m.PrecisionAtK.GetValueOrDefault(k, 0.0));
                    cbAggregate.AvgRecallAtK[k] = cbMetrics.Average(m => m.RecallAtK.GetValueOrDefault(k, 0.0));
                    cbAggregate.AvgNDCGAtK[k] = cbMetrics.Average(m => m.NDCGAtK.GetValueOrDefault(k, 0.0));
                    cbAggregate.AvgHitRateAtK[k] = cbMetrics.Average(m => m.HitRateAtK.GetValueOrDefault(k, 0.0));
                    cbAggregate.AvgMutualAcceptRateAtK[k] = cbMetrics.Average(m => m.MutualAcceptRateAtK.GetValueOrDefault(k, 0.0));
                    cbAggregate.AvgChatStartRateAtK[k] = cbMetrics.Average(m => m.ChatStartRateAtK.GetValueOrDefault(k, 0.0));
                }

                result["ContentBased"] = cbAggregate;
            }

            if (result.Count == 0)
            {
                return BadRequest(new { error = "Could not calculate metrics for any users" });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error comparing algorithms");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private static List<int> NormalizeKValues(List<int>? kValues)
    {
        var normalized = (kValues ?? new List<int> { 5, 10, 20 })
            .Where(k => k > 0)
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        return normalized.Count > 0 ? normalized : new List<int> { 5, 10, 20 };
    }

    private static bool HasCompleteProfile(User user)
    {
        return user.PreferenceAgeMin.HasValue &&
               user.PreferenceAgeMax.HasValue &&
               !string.IsNullOrEmpty(user.PreferenceGender) &&
               !string.IsNullOrEmpty(user.Gender);
    }

    private static List<User> BuildEligibleCandidates(User currentUser, List<User> allUsers)
    {
        if (!HasCompleteProfile(currentUser))
            return new List<User>();

        return allUsers
            .Where(candidate =>
                candidate.Id != currentUser.Id &&
                !currentUser.Disliked.Contains(candidate.Id) &&
                HasCompleteProfile(candidate) &&
                candidate.Age >= currentUser.PreferenceAgeMin &&
                candidate.Age <= currentUser.PreferenceAgeMax &&
                currentUser.Age >= candidate.PreferenceAgeMin &&
                currentUser.Age <= candidate.PreferenceAgeMax &&
                (currentUser.PreferenceGender == "Any" || currentUser.PreferenceGender == candidate.Gender) &&
                (candidate.PreferenceGender == "Any" || candidate.PreferenceGender == currentUser.Gender) &&
                !candidate.Disliked.Contains(currentUser.Id))
            .ToList();
    }

    private static HashSet<string> SelectHoldout(
        List<string> eligibleLiked,
        double holdoutFraction,
        int minHoldoutSize,
        string seedKey)
    {
        if (eligibleLiked.Count == 0)
            return new HashSet<string>();

        var holdoutSize = (int)Math.Ceiling(eligibleLiked.Count * holdoutFraction);
        holdoutSize = Math.Max(minHoldoutSize, holdoutSize);
        if (eligibleLiked.Count > 1)
        {
            holdoutSize = Math.Min(holdoutSize, eligibleLiked.Count - 1);
        }

        var seed = GetDeterministicSeed($"holdout:{seedKey}");
        var random = new Random(seed);
        var shuffled = eligibleLiked.OrderBy(_ => random.Next()).ToList();
        return shuffled.Take(holdoutSize).ToHashSet();
    }

    private static int GetDeterministicSeed(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return BitConverter.ToInt32(bytes, 0);
    }

    private static Dictionary<string, HashSet<string>> BuildLikesByUserId(IEnumerable<User> users)
    {
        var lookup = new Dictionary<string, HashSet<string>>();
        foreach (var user in users)
        {
            lookup[user.Id] = user.Liked.ToHashSet();
        }
        return lookup;
    }

    private static HashSet<string> BuildHoldoutMutualAccepts(
        string userId,
        HashSet<string> holdoutLiked,
        Dictionary<string, HashSet<string>> likesByUserId)
    {
        var mutualAccepts = new HashSet<string>();
        foreach (var holdoutId in holdoutLiked)
        {
            if (likesByUserId.TryGetValue(holdoutId, out var likedSet) && likedSet.Contains(userId))
            {
                mutualAccepts.Add(holdoutId);
            }
        }
        return mutualAccepts;
    }

    private async Task<Dictionary<string, HashSet<string>>> GetChatPartnersAsync(IEnumerable<string> userIds)
    {
        var ids = userIds.Distinct().ToList();
        var lookup = ids.ToDictionary(id => id, _ => new HashSet<string>());

        if (ids.Count == 0)
            return lookup;

        var messages = await _context.Messages
            .Where(m => ids.Contains(m.SenderId) || ids.Contains(m.RecipientId))
            .Select(m => new { m.SenderId, m.RecipientId })
            .ToListAsync();

        foreach (var message in messages)
        {
            if (lookup.TryGetValue(message.SenderId, out var senderSet))
            {
                senderSet.Add(message.RecipientId);
            }
            if (lookup.TryGetValue(message.RecipientId, out var recipientSet))
            {
                recipientSet.Add(message.SenderId);
            }
        }

        return lookup;
    }

    private static List<User> SampleUsers(List<User> users, int maxUsers, int? sampleSeed)
    {
        if (users.Count <= maxUsers)
            return users;

        var seed = sampleSeed ?? 0;
        return users
            .OrderBy(u => GetDeterministicSeed($"sample:{seed}:{u.Id}"))
            .Take(maxUsers)
            .ToList();
    }

    [HttpPost("generate-interactions")]
    public async Task<ActionResult<object>> GenerateRandomInteractions(
        [FromQuery] int count = 50,
        [FromQuery] bool similarityBased = true)
    {
        try
        {
            var users = await _context.Users.ToListAsync();
            
            if (users.Count < 2)
            {
                return BadRequest(new { error = "Need at least 2 users to generate interactions" });
            }

            var random = new Random();
            var interactionsCreated = 0;

            foreach (var user in users)
            {
                var interactionsPerUser = random.Next(3, Math.Min(10, count / users.Count + 1));
                var otherUsers = users.Where(u => u.Id != user.Id).ToList();

                // If similarity-based, prioritize similar users for likes
                List<User> candidatesForLikes;
                if (similarityBased)
                {
                    // Calculate similarity scores
                    var scoredUsers = otherUsers.Select(u => new
                    {
                        User = u,
                        Similarity = CalculateUserSimilarity(user, u)
                    }).OrderByDescending(x => x.Similarity).ToList();

                    // Take top 60% as candidates for likes (more likely to like similar people)
                    var topSimilar = scoredUsers.Take((int)(scoredUsers.Count * 0.6)).Select(x => x.User).ToList();
                    candidatesForLikes = topSimilar;
                }
                else
                {
                    candidatesForLikes = otherUsers;
                }

                for (int i = 0; i < interactionsPerUser && otherUsers.Any(); i++)
                {
                    User targetUser;
                    bool isLike;

                    if (similarityBased && candidatesForLikes.Any() && random.NextDouble() < 0.7)
                    {
                        // 70% chance: pick from similar users for likes
                        var randomIndex = random.Next(candidatesForLikes.Count);
                        targetUser = candidatesForLikes[randomIndex];
                        candidatesForLikes.RemoveAt(randomIndex);
                        isLike = true;
                    }
                    else
                    {
                        // Random selection (for dislikes or remaining interactions)
                        var randomIndex = random.Next(otherUsers.Count);
                        targetUser = otherUsers[randomIndex];
                        otherUsers.RemoveAt(randomIndex);
                        candidatesForLikes.Remove(targetUser);
                        isLike = random.NextDouble() < 0.7; // 70% chance for like
                    }

                    if (isLike && !user.Liked.Contains(targetUser.Id))
                    {
                        user.Liked.Add(targetUser.Id);
                        interactionsCreated++;
                    }
                    else if (!isLike && !user.Disliked.Contains(targetUser.Id))
                    {
                        user.Disliked.Add(targetUser.Id);
                        interactionsCreated++;
                    }
                }
            }

            await _context.SaveChangesAsync();

            var totalLikes = users.Sum(u => u.Liked.Count);
            var totalDislikes = users.Sum(u => u.Disliked.Count);

            _logger.LogInformation(
                "Generated {InteractionsCreated} interactions: {Likes} likes, {Dislikes} dislikes",
                interactionsCreated, totalLikes, totalDislikes);

            return Ok(new
            {
                message = "Interactions generated successfully",
                interactions_created = interactionsCreated,
                total_likes = totalLikes,
                total_dislikes = totalDislikes,
                users_updated = users.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating interactions");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Calculate similarity between two users based on age, gender, games, and languages.
    /// </summary>
    private static double CalculateUserSimilarity(User u1, User u2)
    {
        double score = 0.0;
        int factors = 0;

        // Age similarity (closer age = higher score)
        if (u1.Age > 0 && u2.Age > 0)
        {
            var ageDiff = Math.Abs(u1.Age - u2.Age);
            score += Math.Max(0, 1.0 - (ageDiff / 20.0)); // Max difference of 20 years
            factors++;
        }

        // Gender match (if preferences match)
        if (!string.IsNullOrEmpty(u1.PreferenceGender) && 
            u1.PreferenceGender != "Any" &&
            !string.IsNullOrEmpty(u2.Gender))
        {
            if (u1.PreferenceGender.Equals(u2.Gender, StringComparison.OrdinalIgnoreCase))
            {
                score += 1.0;
            }
            factors++;
        }

        // Common games (most important)
        if (u1.FavoriteGames.Any() && u2.FavoriteGames.Any())
        {
            var commonGames = u1.FavoriteGames.Intersect(u2.FavoriteGames).Count();
            var totalGames = u1.FavoriteGames.Union(u2.FavoriteGames).Count();
            if (totalGames > 0)
            {
                score += (double)commonGames / totalGames * 2.0; // Weight games more
            }
            factors++;
        }

        // Common languages
        if (u1.Languages.Any() && u2.Languages.Any())
        {
            var commonLangs = u1.Languages.Intersect(u2.Languages).Count();
            var totalLangs = u1.Languages.Union(u2.Languages).Count();
            if (totalLangs > 0)
            {
                score += (double)commonLangs / totalLangs;
            }
            factors++;
        }

        return factors > 0 ? score / factors : 0.0;
    }

    [HttpPost("upload-dataset")]
    [RequestSizeLimit(10_000_000)] // 10MB limit
    public async Task<ActionResult<object>> UploadDataset(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file uploaded" });
            }

            if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = "File must be a CSV file" });
            }

            if (file.Length > 10_000_000) // 10MB
            {
                return BadRequest(new { error = "File size exceeds 10MB limit" });
            }

            _logger.LogInformation("Starting CSV import from file: {FileName} ({Size} bytes)", 
                file.FileName, file.Length);

            // Parse CSV
            var importResult = _csvImportService.ImportFromCsv(file.OpenReadStream());
            var users = importResult.Users;
            var errors = importResult.Errors;

            if (users.Count == 0)
            {
                return BadRequest(new 
                { 
                    error = "No users imported",
                    errors = errors 
                });
            }

            // Validate liked/disliked references
            var allUserIds = users.Select(u => u.Id).ToHashSet();
            foreach (var user in users)
            {
                user.Liked = user.Liked.Where(id => allUserIds.Contains(id)).ToList();
                user.Disliked = user.Disliked.Where(id => allUserIds.Contains(id)).ToList();
            }

            // Check for duplicate emails in CSV file
            var emailGroups = users.GroupBy(u => u.Email.ToLowerInvariant())
                .Where(g => g.Count() > 1)
                .ToList();
            
            if (emailGroups.Any())
            {
                var duplicateEmails = emailGroups.Select(g => new
                {
                    email = g.Key,
                    count = g.Count(),
                    user_ids = g.Select(u => u.Id).ToList()
                }).ToList();

                return BadRequest(new
                {
                    error = "Duplicate emails found in CSV file",
                    message = "Emails must be unique. The following emails appear multiple times:",
                    duplicate_emails = duplicateEmails,
                    total_duplicates = duplicateEmails.Count
                });
            }

            // Check for existing emails in database
            var csvEmails = users.Select(u => u.Email.ToLowerInvariant()).ToHashSet();
            
            // Load all emails from database first (to avoid EF translation issues with ToLowerInvariant)
            var allDbEmails = await _context.Users
                .Select(u => u.Email)
                .ToListAsync();
            
            // Compare in memory (case-insensitive)
            var existingEmails = allDbEmails
                .Where(dbEmail => csvEmails.Contains(dbEmail.ToLowerInvariant()))
                .ToList();

            if (existingEmails.Any())
            {
                return Conflict(new
                {
                    error = "Email already exists in database",
                    message = "The following emails already exist in the database and cannot be imported:",
                    existing_emails = existingEmails,
                    total_conflicts = existingEmails.Count
                });
            }

            // Import to database
            int imported = 0;
            int skipped = 0;
            foreach (var user in users)
            {
                try
                {
                    // Check if user already exists by ID
                    var existing = await _context.Users.FindAsync(user.Id);
                    if (existing != null)
                    {
                        // Update existing user
                        existing.DisplayName = user.DisplayName;
                        existing.Email = user.Email;
                        existing.Age = user.Age;
                        existing.Gender = user.Gender;
                        existing.Description = user.Description;
                        existing.PhotoUrl = user.PhotoUrl;
                        existing.FavoriteCategory = user.FavoriteCategory;
                        existing.PreferenceGender = user.PreferenceGender;
                        existing.PreferenceAgeMin = user.PreferenceAgeMin;
                        existing.PreferenceAgeMax = user.PreferenceAgeMax;
                        existing.FavoriteGames = user.FavoriteGames;
                        existing.Languages = user.Languages;
                        existing.PreferenceCategories = user.PreferenceCategories;
                        existing.PreferenceLanguages = user.PreferenceLanguages;
                        existing.Liked = user.Liked;
                        existing.Disliked = user.Disliked;
                        existing.CreatedAt = user.CreatedAt;
                        skipped++;
                    }
                    else
                    {
                        _context.Users.Add(user);
                        imported++;
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Error importing user {user.Id}: {ex.Message}");
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                // Check if it's a unique constraint violation on email
                if (dbEx.InnerException?.Message?.Contains("IX_users_email") == true ||
                    dbEx.InnerException?.Message?.Contains("unique constraint") == true ||
                    dbEx.InnerException?.Message?.Contains("duplicate key") == true)
                {
                    _logger.LogWarning(dbEx, "Email uniqueness constraint violation during CSV import");
                    
                    // Try to identify which email(s) caused the issue
                    var conflictingEmails = users
                        .Select(u => u.Email)
                        .GroupBy(e => e.ToLowerInvariant())
                        .Where(g => g.Count() > 1)
                        .Select(g => g.Key)
                        .ToList();

                    return Conflict(new
                    {
                        error = "Email uniqueness constraint violation",
                        message = "One or more emails in the CSV file violate the unique email constraint. This may be due to duplicate emails in the file or emails that already exist in the database.",
                        conflicting_emails = conflictingEmails.Any() ? conflictingEmails : new List<string> { "Unable to identify specific conflicting emails" },
                        suggestion = "Please ensure all emails in the CSV file are unique and do not exist in the database."
                    });
                }
                
                throw; // Re-throw if it's a different database error
            }

            _logger.LogInformation(
                "CSV import completed: {Imported} new users, {Updated} updated, {Errors} errors",
                imported, skipped, errors.Count);

            return Ok(new
            {
                message = "Dataset imported successfully",
                users_imported = imported,
                users_updated = skipped,
                interactions_imported = importResult.InteractionsImported,
                likes_count = importResult.LikesCount,
                dislikes_count = importResult.DislikesCount,
                errors = errors.Take(10).ToList(), // Limit errors shown
                total_errors = errors.Count
            });
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Database error during CSV import");
            
            // Check for email uniqueness constraint
            if (dbEx.InnerException?.Message?.Contains("IX_users_email") == true ||
                dbEx.InnerException?.Message?.Contains("unique constraint") == true ||
                dbEx.InnerException?.Message?.Contains("duplicate key") == true)
            {
                return Conflict(new
                {
                    error = "Email uniqueness constraint violation",
                    message = "One or more emails in the CSV file already exist in the database or are duplicated within the file.",
                    suggestion = "Please ensure all emails are unique and do not exist in the database before importing."
                });
            }
            
            return StatusCode(500, new 
            { 
                error = "Database error", 
                message = "An error occurred while saving to the database. See inner exception for details.",
                details = dbEx.InnerException?.Message ?? dbEx.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error importing CSV dataset");
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }
}
