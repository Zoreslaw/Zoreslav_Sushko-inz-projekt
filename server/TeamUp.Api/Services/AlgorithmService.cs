namespace TeamUp.Api.Services;

/// <summary>
/// Service to manage the current recommendation algorithm selection.
/// Stores the algorithm preference in memory (can be extended to use database/Redis).
/// </summary>
public class AlgorithmService
{
    private string _currentAlgorithm = "Hybrid"; // Default algorithm
    private readonly object _lock = new object();
    private readonly ILogger<AlgorithmService> _logger;

    public AlgorithmService(ILogger<AlgorithmService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Gets the currently selected algorithm.
    /// </summary>
    public string GetCurrentAlgorithm()
    {
        lock (_lock)
        {
            return _currentAlgorithm;
        }
    }

    /// <summary>
    /// Sets the current algorithm. Valid values: "TwoTower", "ContentBased", or "Hybrid"
    /// </summary>
    public bool SetAlgorithm(string algorithm)
    {
        if (string.IsNullOrWhiteSpace(algorithm))
        {
            return false;
        }

        var normalized = algorithm.Trim();
        if (normalized.Equals("TwoTower", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("ContentBased", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("Hybrid", StringComparison.OrdinalIgnoreCase))
        {
            lock (_lock)
            {
                var previous = _currentAlgorithm;
                _currentAlgorithm = normalized;
                _logger.LogInformation(
                    "Algorithm changed from {PreviousAlgorithm} to {NewAlgorithm}",
                    previous, normalized);
                return true;
            }
        }

        _logger.LogWarning("Invalid algorithm value attempted: {Algorithm}", algorithm);
        return false;
    }
}

