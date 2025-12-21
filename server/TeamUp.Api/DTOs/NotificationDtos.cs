namespace TeamUp.Api.DTOs;

public class RegisterDeviceTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = "unknown";
    public string? DeviceId { get; set; }
}

public class UnregisterDeviceTokenRequest
{
    public string Token { get; set; } = string.Empty;
}

public class DeviceTokenResponse
{
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
