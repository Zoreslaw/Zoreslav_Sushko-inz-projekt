namespace TeamUp.Api.DTOs;

public class ProfileStatsResponse
{
    public int Matches { get; set; }
    public int MessagesSent { get; set; }
    public int MessagesReceived { get; set; }
    public int ConversationsStarted { get; set; }
    public int LikesGiven { get; set; }
    public int LikesReceived { get; set; }
    public DateTime? LastActiveAt { get; set; }
}
