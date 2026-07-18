using Ledger.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Application;

public interface ILedgerDbContext
{
    DbSet<User> Users { get; }
    DbSet<Preferences> Preferences { get; }
    DbSet<OnboardingDraft> OnboardingDrafts { get; }
    DbSet<Goal> Goals { get; }
    DbSet<WeighIn> WeighIns { get; }
    DbSet<Streak> Streaks { get; }
    DbSet<Milestone> Milestones { get; }
    DbSet<RefreshSession> RefreshSessions { get; }
    DbSet<OneTimeToken> OneTimeTokens { get; }
    DbSet<SyncChange> SyncChanges { get; }
    DbSet<AuditRecord> AuditRecords { get; }
    DbSet<PushSubscription> PushSubscriptions { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IPasswordService { string Hash(string password); bool Verify(string password, string hash); }
public interface ITokenService
{
    string CreateAccessToken(User user, DateTimeOffset expiresAt);
    string CreateOpaqueToken();
    string HashToken(string token);
}
public interface IEmailSender { Task SendAsync(string email, string subject, string text, CancellationToken ct); }
public interface IAppLinks { string VerifyEmail(string token); string ResetPassword(string token); }
public interface IRealtimeNotifier { Task SendAsync(Guid userId, object change, CancellationToken ct); }
public interface IAvatarStore { Task<string> SaveAsync(Guid userId, Stream content, string contentType, CancellationToken ct); }
public interface IWebPushSender { Task SendAsync(PushSubscription subscription, string title, string body, CancellationToken ct); }
public interface IVapidKeys { string PublicKey { get; } string PrivateKey { get; } string Subject { get; } }
public interface ILedgerMetrics { void RecordWeighIn(int badgesEarned); }
public interface IUserContext { Guid UserId { get; } string? SourceIp { get; } string? UserAgent { get; } }
public interface ILocalDate { DateOnly Today(string timeZone); DateTimeOffset UtcNow { get; } }

public sealed class AppProblem(int status, string code, string message, IReadOnlyDictionary<string, string[]>? errors = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors ?? new Dictionary<string, string[]>();
    public static AppProblem Validation(string field, string message) => new(400, "validation_failed", "One or more fields are invalid.", new Dictionary<string, string[]> { [field] = [message] });
    public static AppProblem NotFound() => new(404, "not_found", "The requested resource was not found.");
}

public sealed record AuthResult(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, Guid UserId, string Name, bool Onboarded);
public sealed record WeighInDto(Guid Id, DateOnly Date, decimal WeightKg, string? Note, DateTimeOffset UpdatedAt);
public sealed record GoalDto(Guid Id, decimal StartWeightKg, decimal GoalWeightKg, DateOnly TargetDate, GoalDirection Direction, DateTimeOffset? ReachedAt);
public sealed record PreferenceDto(WeightUnit Unit, ThemePreference Theme, WeekStart WeekStartsOn, string TimeZone, bool ReminderEnabled, TimeOnly ReminderTime, bool QuietHoursEnabled, TimeOnly QuietHoursStart, TimeOnly QuietHoursEnd);

public static class ApplicationRules
{
    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();
    public static void ValidatePassword(string password)
    {
        if (password.Length < 8 || !password.Any(char.IsDigit) || !password.Any(ch => !char.IsLetterOrDigit(ch)))
            throw AppProblem.Validation("password", "Use at least 8 characters with a number and a symbol.");
    }
    public static void ValidateWeight(decimal kg)
    {
        if (kg is < 20m or > 500m) throw AppProblem.Validation("weightKg", "Weight must be between 20.0 and 500.0 kg.");
    }
    public static PreferenceDto ToDto(this Preferences p) => new(p.Unit, p.Theme, p.WeekStartsOn, p.TimeZone, p.ReminderEnabled, p.ReminderTime, p.QuietHoursEnabled, p.QuietHoursStart, p.QuietHoursEnd);
    public static WeighInDto ToDto(this WeighIn w) => new(w.Id, w.Date, w.WeightKg, w.Note, w.UpdatedAt);
    public static GoalDto ToDto(this Goal g) => new(g.Id, g.StartWeightKg, g.GoalWeightKg, g.TargetDate, g.Direction, g.ReachedAt);
}
