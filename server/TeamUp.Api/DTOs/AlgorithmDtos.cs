namespace TeamUp.Api.DTOs;

public class AlgorithmResponse
{
    public string Algorithm { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class SetAlgorithmRequest
{
    public string Algorithm { get; set; } = string.Empty;
}

