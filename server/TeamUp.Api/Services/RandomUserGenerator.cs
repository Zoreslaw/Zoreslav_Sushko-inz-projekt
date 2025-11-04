using TeamUp.Api.Models;

namespace TeamUp.Api.Services;

public class RandomUserGenerator
{
    private static readonly Random _random = new();
    
    private static readonly string[] FirstNames = 
    {
        "Alex", "Jordan", "Taylor", "Morgan", "Casey",
        "Riley", "Avery", "Quinn", "Skyler", "Cameron",
        "Charlie", "Dakota", "Emerson", "Finley", "Harper",
        "Hayden", "Jamie", "Kendall", "Logan", "Parker"
    };
    
    private static readonly string[] LastNames = 
    {
        "Smith", "Johnson", "Williams", "Brown", "Jones",
        "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
        "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin"
    };
    
    private static readonly string[] Genders = { "Male", "Female" };
    
    private static readonly string[] Games = 
    {
        "CS2", "Dota2", "Valorant", "League of Legends", "Overwatch",
        "Apex Legends", "Fortnite", "PUBG", "Rainbow Six Siege", "Rocket League"
    };
    
    private static readonly string[] Categories = 
    {
        "FPS", "MOBA", "Strategy", "Action", "RPG", "Sports", "Racing"
    };
    
    private static readonly string[] Languages = 
    {
        "en", "ru", "es", "fr", "de", "it", "pt", "pl", "zh", "ja"
    };
    
    private static readonly string[] Descriptions = 
    {
        "Love playing competitive games!",
        "Looking for teammates to play with",
        "Casual gamer, just here for fun",
        "Experienced player, looking for serious team",
        "New to gaming, want to learn",
        "Friendly player, let's have fun together!",
        "Competitive mindset, aim to win",
        "Just want to chill and play some games"
    };

    public static User GenerateRandomUser()
    {
        var firstName = FirstNames[_random.Next(FirstNames.Length)];
        var lastName = LastNames[_random.Next(LastNames.Length)];
        var gender = Genders[_random.Next(Genders.Length)];
        var age = _random.Next(18, 45);
        
        var numGames = _random.Next(1, 4);
        var favoriteGames = Games.OrderBy(x => _random.Next()).Take(numGames).ToList();
        
        var numLanguages = _random.Next(1, 3);
        var languages = Languages.OrderBy(x => _random.Next()).Take(numLanguages).ToList();
        
        var numCategories = _random.Next(1, 3);
        var categories = Categories.OrderBy(x => _random.Next()).Take(numCategories).ToList();
        
        var preferenceGender = _random.Next(3) switch
        {
            0 => "Male",
            1 => "Female",
            _ => "Any"
        };
        
        var ageRange = _random.Next(5, 15);
        var preferenceAgeMin = Math.Max(18, age - ageRange);
        var preferenceAgeMax = Math.Min(65, age + ageRange);

        return new User
        {
            Id = Guid.NewGuid().ToString(),
            DisplayName = $"{firstName} {lastName}",
            Email = $"{firstName.ToLower()}.{lastName.ToLower()}{_random.Next(100, 999)}@example.com",
            Age = age,
            Gender = gender,
            Description = Descriptions[_random.Next(Descriptions.Length)],
            PhotoUrl = $"https://api.dicebear.com/7.x/avataaars/svg?seed={firstName}{lastName}",
            FavoriteCategory = categories.First(),
            FavoriteGames = favoriteGames,
            Languages = languages,
            PreferenceGender = preferenceGender,
            PreferenceAgeMin = preferenceAgeMin,
            PreferenceAgeMax = preferenceAgeMax,
            PreferenceCategories = categories,
            PreferenceLanguages = languages,
            Liked = new List<string>(),
            Disliked = new List<string>(),
            CreatedAt = DateTime.UtcNow
        };
    }
}


