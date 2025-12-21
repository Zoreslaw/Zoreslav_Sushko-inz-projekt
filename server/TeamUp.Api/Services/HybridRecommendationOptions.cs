namespace TeamUp.Api.Services;

public class HybridRecommendationOptions
{
    public double TwoTowerWeight { get; set; } = 0.45;
    public double ContentWeight { get; set; } = 0.35;
    public double PreferenceWeight { get; set; } = 0.15;
    public double InteractionWeight { get; set; } = 0.05;
    public int AgeSlackYears { get; set; } = 5;
    public double MissingValueNeutralScore { get; set; } = 0.5;
    public int MaxCandidatePool { get; set; } = 1000;
}
