namespace TeamUp.Api.DTOs;

public class MetricsRequest
{
    public string UserId { get; set; } = string.Empty;
    public List<int> KValues { get; set; } = new() { 5, 10, 20 };
}

public class MetricsResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Algorithm { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public Dictionary<int, double> PrecisionAtK { get; set; } = new();
    public Dictionary<int, double> RecallAtK { get; set; } = new();
    public Dictionary<int, double> NDCGAtK { get; set; } = new();
    public Dictionary<int, double> HitRateAtK { get; set; } = new();
    public Dictionary<int, double> MutualAcceptRateAtK { get; set; } = new();
    public Dictionary<int, double> ChatStartRateAtK { get; set; } = new();
}

public class AggregateMetricsResponse
{
    public string Algorithm { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public int UserCount { get; set; }
    public Dictionary<int, double> AvgPrecisionAtK { get; set; } = new();
    public Dictionary<int, double> AvgRecallAtK { get; set; } = new();
    public Dictionary<int, double> AvgNDCGAtK { get; set; } = new();
    public Dictionary<int, double> AvgHitRateAtK { get; set; } = new();
    public Dictionary<int, double> AvgMutualAcceptRateAtK { get; set; } = new();
    public Dictionary<int, double> AvgChatStartRateAtK { get; set; } = new();
}

