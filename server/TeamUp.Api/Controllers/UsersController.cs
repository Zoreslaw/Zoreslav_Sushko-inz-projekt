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

    public UsersController(
        ApplicationDbContext context, 
        ILogger<UsersController> logger,
        MLServiceClient mlServiceClient)
    {
        _context = context;
        _logger = logger;
        _mlServiceClient = mlServiceClient;
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

            _logger.LogInformation(
                "Getting recommendations for user {UserId} from {CandidateCount} candidates",
                userId, candidates.Count);

            var mlResponse = await _mlServiceClient.GetRecommendationsAsync(
                targetUser, 
                candidates, 
                topK);

            if (mlResponse == null)
            {
                return StatusCode(503, new 
                { 
                    error = "ML Service unavailable",
                    message = "Could not get recommendations from ML service"
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

    [HttpPost("generate-interactions")]
    public async Task<ActionResult<object>> GenerateRandomInteractions([FromQuery] int count = 50)
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

                for (int i = 0; i < interactionsPerUser && otherUsers.Any(); i++)
                {
                    var randomIndex = random.Next(otherUsers.Count);
                    var targetUser = otherUsers[randomIndex];
                    otherUsers.RemoveAt(randomIndex);

                    // 70% chance for like, 30% for dislike
                    if (random.NextDouble() < 0.7)
                    {
                        if (!user.Liked.Contains(targetUser.Id))
                        {
                            user.Liked.Add(targetUser.Id);
                            interactionsCreated++;
                        }
                    }
                    else
                    {
                        if (!user.Disliked.Contains(targetUser.Id))
                        {
                            user.Disliked.Add(targetUser.Id);
                            interactionsCreated++;
                        }
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
}

