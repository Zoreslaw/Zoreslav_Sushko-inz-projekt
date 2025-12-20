using TeamUp.Api.DTOs;
using TeamUp.Api.Models;

namespace TeamUp.Api.Mappers;

public static class ProfileMapper
{
    public static UserProfileResponse ToProfileResponse(User user)
    {
        return new UserProfileResponse
        {
            Id = user.Id,
            DisplayName = user.DisplayName,
            Email = user.Email,
            PhotoUrl = user.PhotoUrl,
            Age = user.Age,
            Gender = user.Gender,
            Description = user.Description,
            FavoriteCategory = user.FavoriteCategory,
            FavoriteGames = user.FavoriteGames,
            OtherGames = user.OtherGames,
            Languages = user.Languages,
            PreferenceCategories = user.PreferenceCategories,
            PreferenceLanguages = user.PreferenceLanguages,
            PreferenceGender = user.PreferenceGender,
            PreferenceAgeMin = user.PreferenceAgeMin,
            PreferenceAgeMax = user.PreferenceAgeMax,
            SteamId = user.SteamId,
            SteamDisplayName = user.SteamDisplayName,
            SteamProfileUrl = user.SteamProfileUrl,
            SteamAvatarUrl = user.SteamAvatarUrl,
            SteamGames = user.SteamGames,
            SteamCategories = user.SteamCategories,
            SteamLastSyncedAt = user.SteamLastSyncedAt,
            CreatedAt = user.CreatedAt
        };
    }
}
