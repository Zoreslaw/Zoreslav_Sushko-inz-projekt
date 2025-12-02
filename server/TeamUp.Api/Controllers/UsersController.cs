using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        [FromBody] MetricsRequest? request = null)
    {
        try
        {
            var targetUser = await _context.Users.FindAsync(userId);
            if (targetUser == null)
            {
                return NotFound(new { error = "User not found" });
            }

            var kValues = request?.KValues ?? new List<int> { 5, 10, 20 };
            var algorithm = _algorithmService.GetCurrentAlgorithm();

            // Get recommendations using current algorithm
            var candidates = await _context.Users
                .Where(u => u.Id != userId && 
                           !targetUser.Liked.Contains(u.Id) && 
                           !targetUser.Disliked.Contains(u.Id))
                .ToListAsync();

            if (candidates.Count == 0)
            {
                return BadRequest(new { error = "No candidates available for metrics calculation" });
            }

            MLRecommendationResponse? mlResponse = null;
            if (algorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
            {
                mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                    targetUser, candidates, kValues.Max());
            }
            else
            {
                mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                    targetUser, candidates, kValues.Max());
            }

            if (mlResponse == null)
            {
                return StatusCode(503, new { error = "Recommendation service unavailable" });
            }

            var recommendedIds = mlResponse.Results.Select(r => r.UserId).ToList();
            var metrics = _metricsService.CalculateMetrics(userId, recommendedIds, kValues);
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
                ChatStartRateAtK = metrics.ChatStartRateAtK
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
        [FromQuery] List<int>? kValues = null)
    {
        try
        {
            var currentAlgorithm = algorithm ?? _algorithmService.GetCurrentAlgorithm();
            var kVals = kValues ?? new List<int> { 5, 10, 20 };

            var users = await _context.Users
                .Where(u => u.Liked.Count > 0) // Only users with interactions
                .ToListAsync();

            if (users.Count == 0)
            {
                return BadRequest(new { error = "No users with interactions found" });
            }

            var allMetrics = new List<RecommendationMetrics>();
            var candidates = await _context.Users.ToListAsync();

            foreach (var user in users.Take(100)) // Limit to 100 users for performance
            {
                try
                {
                    // For evaluation, we need to include some liked users in candidates
                    // to measure if the algorithm would have recommended them
                    // We'll use a holdout approach: exclude 20% of liked users for evaluation
                    var likedUsers = user.Liked.ToList();
                    var holdoutSize = Math.Max(1, (int)(likedUsers.Count * 0.2)); // Hold out 20% for evaluation
                    var holdoutLiked = likedUsers.Take(holdoutSize).ToHashSet();
                    var remainingLiked = likedUsers.Skip(holdoutSize).ToHashSet();
                    
                    // Candidates: all users except self, disliked, and the holdout liked users
                    // But we'll add back the holdout liked users for evaluation
                    var userCandidates = candidates
                        .Where(u => u.Id != user.Id && 
                                   !user.Disliked.Contains(u.Id) &&
                                   !remainingLiked.Contains(u.Id)) // Exclude non-holdout liked
                        .ToList();
                    
                    // Add holdout liked users back for evaluation
                    var holdoutCandidates = candidates
                        .Where(u => holdoutLiked.Contains(u.Id))
                        .ToList();
                    userCandidates.AddRange(holdoutCandidates);

                    if (userCandidates.Count == 0)
                        continue;

                    // Log for debugging
                    _logger.LogDebug(
                        "User {UserId}: {HoldoutCount} holdout users, {CandidateCount} total candidates",
                        user.Id, holdoutLiked.Count, userCandidates.Count);

                    MLRecommendationResponse? mlResponse = null;
                    if (currentAlgorithm.Equals("ContentBased", StringComparison.OrdinalIgnoreCase))
                    {
                        mlResponse = await _cbServiceClient.GetRecommendationsAsync(
                            user, userCandidates, kVals.Max());
                    }
                    else
                    {
                        mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                            user, userCandidates, kVals.Max());
                    }

                    if (mlResponse != null)
                    {
                        var recommendedIds = mlResponse.Results.Select(r => r.UserId).Distinct().ToList();
                        
                        // Validate: ensure no duplicates in recommendations
                        if (recommendedIds.Count != mlResponse.Results.Count)
                        {
                            _logger.LogWarning(
                                "User {UserId}: Found duplicate user IDs in recommendations. Original: {Original}, Unique: {Unique}",
                                user.Id, mlResponse.Results.Count, recommendedIds.Count);
                        }
                        
                        // Check if any holdout users were recommended
                        var holdoutInRecommendations = recommendedIds.Intersect(holdoutLiked).ToList();
                        if (holdoutInRecommendations.Any())
                        {
                            _logger.LogDebug(
                                "User {UserId}: Algorithm recommended {Count}/{Total} holdout users: {UserIds}",
                                user.Id, holdoutInRecommendations.Count, holdoutLiked.Count, string.Join(", ", holdoutInRecommendations));
                        }
                        else
                        {
                            _logger.LogDebug(
                                "User {UserId}: Algorithm did not recommend any holdout users. " +
                                "Holdout users: {HoldoutIds}, Top recommendations: {TopRecs}",
                                user.Id, 
                                string.Join(", ", holdoutLiked.Take(3)),
                                string.Join(", ", recommendedIds.Take(5)));
                        }
                        
                        // Calculate mutual accepts and chat starts ONLY from holdout users
                        // This ensures metrics are calculated correctly with holdout ground truth
                        var holdoutMutualAccepts = new HashSet<string>();
                        var holdoutChatStarts = new HashSet<string>();
                        
                        foreach (var holdoutId in holdoutLiked)
                        {
                            var holdoutUser = await _context.Users.FindAsync(holdoutId);
                            if (holdoutUser != null && holdoutUser.Liked.Contains(user.Id))
                            {
                                holdoutMutualAccepts.Add(holdoutId);
                                holdoutChatStarts.Add(holdoutId); // Using mutual accepts as proxy
                            }
                        }
                        
                        // Validate ground truth size
                        if (holdoutLiked.Count == 0)
                        {
                            _logger.LogWarning("User {UserId}: Holdout set is empty, skipping metrics", user.Id);
                            continue;
                        }
                        
                        // Use holdout liked users as ground truth for evaluation
                        var metrics = _metricsService.CalculateMetricsWithGroundTruth(
                            user.Id, recommendedIds, holdoutLiked, kVals, holdoutMutualAccepts, holdoutChatStarts);
                        metrics.Algorithm = currentAlgorithm;
                        allMetrics.Add(metrics);
                    }
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

            // Aggregate metrics
            var aggregate = new AggregateMetricsResponse
            {
                Algorithm = currentAlgorithm,
                Timestamp = DateTime.UtcNow,
                UserCount = allMetrics.Count
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

