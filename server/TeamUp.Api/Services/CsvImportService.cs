using System.Globalization;
using System.Text;
using System.Text.Json;
using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class CsvImportService
{
    private readonly ILogger<CsvImportService> _logger;

    public CsvImportService(ILogger<CsvImportService> logger)
    {
        _logger = logger;
    }

    public class ImportResult
    {
        public int UsersImported { get; set; }
        public int InteractionsImported { get; set; }
        public int LikesCount { get; set; }
        public int DislikesCount { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<User> Users { get; set; } = new();
    }

    public ImportResult ImportFromCsv(Stream csvStream)
    {
        var result = new ImportResult();
        var users = new List<User>();
        var errors = new List<string>();

        using var reader = new StreamReader(csvStream);
        
        // Read header
        var headerLine = reader.ReadLine();
        if (string.IsNullOrEmpty(headerLine))
        {
            errors.Add("CSV file is empty or missing header");
            result.Errors = errors;
            return result;
        }

        var headers = ParseCsvLine(headerLine);
        var expectedHeaders = new[] { "id", "display_name", "email", "age", "gender", "favorite_games", 
            "languages", "liked", "disliked" };
        
        // Validate headers
        var missingHeaders = expectedHeaders.Where(h => !headers.Contains(h, StringComparer.OrdinalIgnoreCase)).ToList();
        if (missingHeaders.Any())
        {
            errors.Add($"Missing required headers: {string.Join(", ", missingHeaders)}");
        }

        int lineNumber = 1;
        while (!reader.EndOfStream)
        {
            lineNumber++;
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) continue;

            try
            {
                var values = ParseCsvLine(line);
                if (values.Count != headers.Count)
                {
                    errors.Add($"Line {lineNumber}: Column count mismatch");
                    continue;
                }

                var user = ParseUserRow(headers, values, lineNumber, errors);
                if (user != null)
                {
                    users.Add(user);
                }
            }
            catch (Exception ex)
            {
                errors.Add($"Line {lineNumber}: {ex.Message}");
            }
        }

        // Count interactions
        int likesCount = 0;
        int dislikesCount = 0;
        foreach (var user in users)
        {
            likesCount += user.Liked.Count;
            dislikesCount += user.Disliked.Count;
        }

        result.UsersImported = users.Count;
        result.LikesCount = likesCount;
        result.DislikesCount = dislikesCount;
        result.InteractionsImported = likesCount + dislikesCount;
        result.Errors = errors;
        result.Users = users;

        _logger.LogInformation(
            "CSV Import: {UsersImported} users, {Likes} likes, {Dislikes} dislikes, {Errors} errors",
            result.UsersImported, result.LikesCount, result.DislikesCount, errors.Count);

        return result;
    }

    public User? ParseUserRow(List<string> headers, List<string> values, int lineNumber, List<string> errors)
    {
        try
        {
            var user = new User();
            var headerDict = headers.Select((h, i) => new { h, i })
                .ToDictionary(x => x.h.ToLowerInvariant(), x => x.i);

            // Required fields
            if (!headerDict.TryGetValue("id", out var idIdx) || string.IsNullOrWhiteSpace(values[idIdx]))
            {
                errors.Add($"Line {lineNumber}: Missing or empty id");
                return null;
            }
            user.Id = values[idIdx].Trim();

            if (!headerDict.TryGetValue("display_name", out var nameIdx) || string.IsNullOrWhiteSpace(values[nameIdx]))
            {
                errors.Add($"Line {lineNumber}: Missing or empty display_name");
                return null;
            }
            user.DisplayName = values[nameIdx].Trim();

            if (!headerDict.TryGetValue("email", out var emailIdx) || string.IsNullOrWhiteSpace(values[emailIdx]))
            {
                errors.Add($"Line {lineNumber}: Missing or empty email");
                return null;
            }
            user.Email = values[emailIdx].Trim();

            if (!headerDict.TryGetValue("age", out var ageIdx) || !int.TryParse(values[ageIdx], out var age))
            {
                errors.Add($"Line {lineNumber}: Invalid age");
                return null;
            }
            user.Age = age;

            if (!headerDict.TryGetValue("gender", out var genderIdx) || string.IsNullOrWhiteSpace(values[genderIdx]))
            {
                errors.Add($"Line {lineNumber}: Missing or empty gender");
                return null;
            }
            user.Gender = values[genderIdx].Trim();

            // Optional fields
            if (headerDict.TryGetValue("description", out var descIdx))
                user.Description = values[descIdx]?.Trim();
            
            if (headerDict.TryGetValue("photo_url", out var photoIdx))
                user.PhotoUrl = values[photoIdx]?.Trim();
            
            if (headerDict.TryGetValue("favorite_category", out var catIdx))
                user.FavoriteCategory = values[catIdx]?.Trim();
            
            if (headerDict.TryGetValue("preference_gender", out var prefGenIdx))
                user.PreferenceGender = values[prefGenIdx]?.Trim();
            
            if (headerDict.TryGetValue("preference_age_min", out var ageMinIdx) && 
                int.TryParse(values[ageMinIdx], out var ageMin))
                user.PreferenceAgeMin = ageMin;
            
            if (headerDict.TryGetValue("preference_age_max", out var ageMaxIdx) && 
                int.TryParse(values[ageMaxIdx], out var ageMax))
                user.PreferenceAgeMax = ageMax;

            // JSON array fields
            if (headerDict.TryGetValue("favorite_games", out var gamesIdx))
                user.FavoriteGames = ParseJsonArray(values[gamesIdx]);
            
            if (headerDict.TryGetValue("languages", out var langIdx))
                user.Languages = ParseJsonArray(values[langIdx]);
            
            if (headerDict.TryGetValue("preference_categories", out var prefCatIdx))
                user.PreferenceCategories = ParseJsonArray(values[prefCatIdx]);
            
            if (headerDict.TryGetValue("preference_languages", out var prefLangIdx))
                user.PreferenceLanguages = ParseJsonArray(values[prefLangIdx]);
            
            if (headerDict.TryGetValue("liked", out var likedIdx))
                user.Liked = ParseJsonArray(values[likedIdx]);
            
            if (headerDict.TryGetValue("disliked", out var dislikedIdx))
                user.Disliked = ParseJsonArray(values[dislikedIdx]);

            // Date - ensure UTC for PostgreSQL
            if (headerDict.TryGetValue("created_at", out var dateIdx) && 
                DateTime.TryParse(values[dateIdx], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var created))
            {
                // Ensure the DateTime is in UTC (PostgreSQL requires UTC)
                // Convert to UTC if it's not already
                if (created.Kind == DateTimeKind.Unspecified)
                    user.CreatedAt = DateTime.SpecifyKind(created, DateTimeKind.Utc);
                else if (created.Kind == DateTimeKind.Local)
                    user.CreatedAt = created.ToUniversalTime();
                else
                    user.CreatedAt = created; // Already UTC
            }
            else
            {
                user.CreatedAt = DateTime.UtcNow;
            }

            return user;
        }
        catch (Exception ex)
        {
            errors.Add($"Line {lineNumber}: Error parsing user - {ex.Message}");
            return null;
        }
    }

    private List<string> ParseJsonArray(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value == "[]")
            return new List<string>();

        try
        {
            // Handle both JSON array format and comma-separated
            if (value.Trim().StartsWith("["))
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(value);
                return parsed ?? new List<string>();
            }
            else
            {
                // Comma-separated fallback
                return value.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim().Trim('"'))
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToList();
            }
        }
        catch
        {
            // Fallback to comma-separated
            return value.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().Trim('"'))
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }
    }

    public List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    // Escaped quote
                    current.Append('"');
                    i++;
                }
                else
                {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        result.Add(current.ToString());
        return result;
    }

    public List<User> GetUsers()
    {
        // This will be populated by ImportFromCsv
        return new List<User>();
    }
}

