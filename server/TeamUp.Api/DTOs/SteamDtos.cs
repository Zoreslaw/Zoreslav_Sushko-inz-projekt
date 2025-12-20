namespace TeamUp.Api.DTOs;

public class SteamConnectRequest
{
    public string SteamIdOrUrl { get; set; } = string.Empty;
}

public class SteamCatalogResponse
{
    public List<string> Items { get; set; } = new();
}
