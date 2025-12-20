using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace TeamUp.Api.Services;

public class SteamService
{
    private const string AppListCacheKey = "steam_app_list";
    private const string CategoryListCacheKey = "steam_category_list";
    private readonly HttpClient _client;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SteamService> _logger;
    private readonly int _appListCacheMinutes;
    private readonly int _categoryCacheMinutes;
    private readonly int _categorySampleApps;
    private readonly int _categoryAppsPerUser;
    private readonly int _searchLimit;

    public SteamService(
        HttpClient client,
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<SteamService> logger)
    {
        _client = client;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
        _appListCacheMinutes = GetConfigInt("Steam:AppListCacheMinutes", 720);
        _categoryCacheMinutes = GetConfigInt("Steam:CategoryCacheMinutes", 720);
        _categorySampleApps = GetConfigInt("Steam:CategorySampleApps", 200);
        _categoryAppsPerUser = GetConfigInt("Steam:CategoryAppsPerUser", 75);
        _searchLimit = GetConfigInt("Steam:SearchLimit", 60);
    }

    public bool HasApiKey => !string.IsNullOrWhiteSpace(ApiKey);

    private string ApiKey => _configuration["Steam:ApiKey"] ?? string.Empty;
    private string WebApiBaseUrl => _configuration["Steam:WebApiBaseUrl"] ?? "https://api.steampowered.com";
    private string StoreBaseUrl => _configuration["Steam:StoreBaseUrl"] ?? "https://store.steampowered.com";

    public async Task<SteamConnectionResult> ConnectAsync(string steamIdOrUrl)
    {
        if (!HasApiKey)
        {
            throw new InvalidOperationException("Steam API key is not configured.");
        }

        var steamId = await ResolveSteamIdAsync(steamIdOrUrl);
        var profile = await GetPlayerSummaryAsync(steamId);
        var games = await GetOwnedGamesAsync(steamId);
        var categories = await GetCategoriesForAppsAsync(games.Select(g => g.AppId), _categoryAppsPerUser);

        return new SteamConnectionResult
        {
            SteamId = steamId,
            SteamDisplayName = profile.DisplayName,
            SteamProfileUrl = profile.ProfileUrl,
            SteamAvatarUrl = profile.AvatarUrl,
            Games = games.Select(g => g.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList(),
            Categories = categories,
            SyncedAt = DateTime.UtcNow
        };
    }

    public async Task<List<string>> SearchAppsAsync(string query, int? limit = null)
    {
        var appList = await GetAppListAsync();
        var normalized = query?.Trim() ?? string.Empty;
        var max = limit.GetValueOrDefault(_searchLimit);

        if (string.IsNullOrWhiteSpace(normalized))
        {
            return appList
                .Where(app => !string.IsNullOrWhiteSpace(app.Name))
                .OrderBy(app => app.Name)
                .Take(max)
                .Select(app => app.Name)
                .ToList();
        }

        return appList
            .Where(app => !string.IsNullOrWhiteSpace(app.Name) &&
                          app.Name.Contains(normalized, StringComparison.OrdinalIgnoreCase))
            .OrderBy(app => app.Name)
            .Take(max)
            .Select(app => app.Name)
            .ToList();
    }

    public async Task<List<string>> SearchCategoriesAsync(string query, int? limit = null)
    {
        var categories = await GetCategoryListAsync();
        var normalized = query?.Trim() ?? string.Empty;
        var max = limit.GetValueOrDefault(_searchLimit);

        if (string.IsNullOrWhiteSpace(normalized))
        {
            return categories
                .OrderBy(name => name)
                .Take(max)
                .ToList();
        }

        return categories
            .Where(category => category.Contains(normalized, StringComparison.OrdinalIgnoreCase))
            .OrderBy(category => category)
            .Take(max)
            .ToList();
    }

    private async Task<string> ResolveSteamIdAsync(string steamIdOrUrl)
    {
        var trimmed = steamIdOrUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new ArgumentException("Steam ID or profile URL is required.");
        }

        if (IsSteamId64(trimmed))
        {
            return trimmed;
        }

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 2 && segments[0].Equals("profiles", StringComparison.OrdinalIgnoreCase))
            {
                var profileId = segments[1];
                if (IsSteamId64(profileId))
                {
                    return profileId;
                }
            }

            if (segments.Length >= 2 && segments[0].Equals("id", StringComparison.OrdinalIgnoreCase))
            {
                return await ResolveVanityUrlAsync(segments[1]);
            }
        }

        return await ResolveVanityUrlAsync(trimmed);
    }

    private async Task<string> ResolveVanityUrlAsync(string vanityUrl)
    {
        var url = $"{WebApiBaseUrl}/ISteamUser/ResolveVanityURL/v0001/?key={ApiKey}&vanityurl={WebUtility.UrlEncode(vanityUrl)}";
        using var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("response", out var responseElement))
        {
            throw new InvalidOperationException("Failed to resolve Steam vanity URL.");
        }

        var success = responseElement.GetProperty("success").GetInt32();
        if (success != 1)
        {
            throw new InvalidOperationException("Steam vanity URL was not found.");
        }

        return responseElement.GetProperty("steamid").GetString() ?? throw new InvalidOperationException("Steam ID missing.");
    }

    private async Task<List<SteamApp>> GetAppListAsync()
    {
        if (_cache.TryGetValue(AppListCacheKey, out List<SteamApp>? cached) && cached != null)
        {
            return cached;
        }

        var url = $"{WebApiBaseUrl}/ISteamApps/GetAppList/v2/";
        using var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var apps = new List<SteamApp>();

        if (doc.RootElement.TryGetProperty("applist", out var appListElement) &&
            appListElement.TryGetProperty("apps", out var appsElement))
        {
            foreach (var app in appsElement.EnumerateArray())
            {
                if (!app.TryGetProperty("appid", out var idElement)) continue;
                if (!app.TryGetProperty("name", out var nameElement)) continue;
                var name = nameElement.GetString() ?? string.Empty;
                apps.Add(new SteamApp { AppId = idElement.GetInt32(), Name = name });
            }
        }

        _cache.Set(AppListCacheKey, apps, TimeSpan.FromMinutes(_appListCacheMinutes));
        return apps;
    }

    private async Task<List<string>> GetCategoryListAsync()
    {
        if (_cache.TryGetValue(CategoryListCacheKey, out List<string>? cached) && cached != null)
        {
            return cached;
        }

        var apps = await GetAppListAsync();
        var sampleApps = apps
            .Where(app => !string.IsNullOrWhiteSpace(app.Name))
            .OrderBy(app => app.Name)
            .Take(_categorySampleApps)
            .Select(app => app.AppId)
            .ToList();

        var categories = await GetCategoriesForAppsAsync(sampleApps, _categorySampleApps);
        _cache.Set(CategoryListCacheKey, categories, TimeSpan.FromMinutes(_categoryCacheMinutes));
        return categories;
    }

    private async Task<List<string>> GetCategoriesForAppsAsync(IEnumerable<int> appIds, int maxApps)
    {
        var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var appIdList = appIds.Distinct().Take(maxApps).ToList();

        foreach (var appId in appIdList)
        {
            try
            {
                var details = await GetAppDetailsAsync(appId);
                foreach (var category in details.Categories)
                {
                    results.Add(category);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load Steam app details for {AppId}", appId);
            }
        }

        return results.OrderBy(name => name).ToList();
    }

    private async Task<SteamAppDetails> GetAppDetailsAsync(int appId)
    {
        var url = $"{StoreBaseUrl}/api/appdetails?appids={appId}&cc=us&l=en";
        using var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty(appId.ToString(), out var appElement))
        {
            return SteamAppDetails.Empty;
        }

        if (!appElement.TryGetProperty("success", out var successElement) || !successElement.GetBoolean())
        {
            return SteamAppDetails.Empty;
        }

        if (!appElement.TryGetProperty("data", out var dataElement))
        {
            return SteamAppDetails.Empty;
        }

        var categories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (dataElement.TryGetProperty("categories", out var categoriesElement))
        {
            foreach (var category in categoriesElement.EnumerateArray())
            {
                if (category.TryGetProperty("description", out var description))
                {
                    var value = description.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        categories.Add(value.Trim());
                    }
                }
            }
        }

        if (dataElement.TryGetProperty("genres", out var genresElement))
        {
            foreach (var genre in genresElement.EnumerateArray())
            {
                if (genre.TryGetProperty("description", out var description))
                {
                    var value = description.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        categories.Add(value.Trim());
                    }
                }
            }
        }

        return new SteamAppDetails(categories.ToList());
    }

    private async Task<SteamProfile> GetPlayerSummaryAsync(string steamId)
    {
        var url = $"{WebApiBaseUrl}/ISteamUser/GetPlayerSummaries/v0002/?key={ApiKey}&steamids={steamId}";
        using var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("response", out var responseElement))
        {
            return SteamProfile.Empty;
        }

        if (!responseElement.TryGetProperty("players", out var playersElement))
        {
            return SteamProfile.Empty;
        }

        var player = playersElement.EnumerateArray().FirstOrDefault();
        if (player.ValueKind == JsonValueKind.Undefined)
        {
            return SteamProfile.Empty;
        }

        return new SteamProfile
        {
            DisplayName = player.TryGetProperty("personaname", out var nameElement)
                ? nameElement.GetString() ?? string.Empty
                : string.Empty,
            ProfileUrl = player.TryGetProperty("profileurl", out var urlElement)
                ? urlElement.GetString() ?? string.Empty
                : string.Empty,
            AvatarUrl = player.TryGetProperty("avatarfull", out var avatarElement)
                ? avatarElement.GetString() ?? string.Empty
                : string.Empty
        };
    }

    private async Task<List<SteamOwnedGame>> GetOwnedGamesAsync(string steamId)
    {
        var url = $"{WebApiBaseUrl}/IPlayerService/GetOwnedGames/v0001/?key={ApiKey}&steamid={steamId}&include_appinfo=1&include_played_free_games=1";
        using var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("response", out var responseElement))
        {
            return new List<SteamOwnedGame>();
        }

        if (!responseElement.TryGetProperty("games", out var gamesElement))
        {
            return new List<SteamOwnedGame>();
        }

        var results = new List<SteamOwnedGame>();
        foreach (var game in gamesElement.EnumerateArray())
        {
            var appId = game.TryGetProperty("appid", out var appIdElement)
                ? appIdElement.GetInt32()
                : 0;
            var name = game.TryGetProperty("name", out var nameElement)
                ? nameElement.GetString() ?? string.Empty
                : string.Empty;

            if (appId != 0 && !string.IsNullOrWhiteSpace(name))
            {
                results.Add(new SteamOwnedGame(appId, name));
            }
        }

        return results;
    }

    private static bool IsSteamId64(string value)
    {
        return value.Length == 17 && value.All(char.IsDigit);
    }

    private int GetConfigInt(string key, int fallback)
    {
        var raw = _configuration[key];
        return int.TryParse(raw, out var parsed) ? parsed : fallback;
    }
}

public class SteamConnectionResult
{
    public string SteamId { get; set; } = string.Empty;
    public string SteamDisplayName { get; set; } = string.Empty;
    public string SteamProfileUrl { get; set; } = string.Empty;
    public string SteamAvatarUrl { get; set; } = string.Empty;
    public List<string> Games { get; set; } = new();
    public List<string> Categories { get; set; } = new();
    public DateTime SyncedAt { get; set; }
}

public record SteamOwnedGame(int AppId, string Name);

public class SteamApp
{
    public int AppId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class SteamProfile
{
    public static SteamProfile Empty => new();
    public string DisplayName { get; set; } = string.Empty;
    public string ProfileUrl { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
}

public class SteamAppDetails
{
    public static SteamAppDetails Empty => new(Array.Empty<string>());

    public SteamAppDetails(IEnumerable<string> categories)
    {
        Categories = categories.ToList();
    }

    public List<string> Categories { get; }
}
