namespace Ledger.Domain;

public enum WeightUnit { Kg, Lbs }
public enum ThemePreference { Light, Dark, System }
public enum WeekStart { Sunday, Monday }
public enum GoalDirection { Loss, Gain }
public enum ScheduleStatus { Ahead, OnTrack, Behind }
public enum BadgeType { FirstEntry, SevenDayStreak, ThirtyDayStreak, OneKg, TwoPointFiveKg, FiveKg, GoalReached, HundredEntries }
public enum ChangeKind { Created, Updated, Deleted }
public enum SyncEntityType { WeighIn, Goal, Preferences, Profile, Milestone }

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string NormalizedEmail { get; set; }
    public required string PasswordHash { get; set; }
    public bool EmailVerified { get; set; }
    public decimal? HeightCm { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTimeOffset MemberSince { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset PasswordUpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public bool IsDeleted { get; set; }
}

public sealed class Preferences
{
    public Guid UserId { get; set; }
    public WeightUnit Unit { get; set; } = WeightUnit.Kg;
    public ThemePreference Theme { get; set; } = ThemePreference.System;
    public WeekStart WeekStartsOn { get; set; } = WeekStart.Monday;
    public string TimeZone { get; set; } = "UTC";
    public bool ReminderEnabled { get; set; }
    public TimeOnly ReminderTime { get; set; } = new(8, 0);
    public DateOnly? LastReminderSentOn { get; set; }
    public bool QuietHoursEnabled { get; set; }
    public TimeOnly QuietHoursStart { get; set; } = new(22, 0);
    public TimeOnly QuietHoursEnd { get; set; } = new(7, 0);

    public bool IsWithinQuietHours(TimeOnly value) => QuietHoursEnabled &&
        (QuietHoursStart <= QuietHoursEnd
            ? value >= QuietHoursStart && value < QuietHoursEnd
            : value >= QuietHoursStart || value < QuietHoursEnd);
}

public sealed class OnboardingDraft
{
    public Guid UserId { get; set; }
    public int LastCompletedStep { get; set; }
    public WeightUnit? Unit { get; set; }
    public decimal? CurrentWeightKg { get; set; }
    public decimal? GoalWeightKg { get; set; }
    public DateOnly? TargetDate { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Goal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public decimal StartWeightKg { get; set; }
    public decimal GoalWeightKg { get; set; }
    public DateOnly TargetDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReachedAt { get; set; }
    public GoalDirection Direction => GoalWeightKg < StartWeightKg ? GoalDirection.Loss : GoalDirection.Gain;

    public decimal PercentComplete(decimal current) => WeightMath.PercentComplete(StartWeightKg, GoalWeightKg, current);
    public decimal RemainingKg(decimal current) => Math.Max(0m, Direction == GoalDirection.Loss ? current - GoalWeightKg : GoalWeightKg - current);
    public bool IsReached(decimal current) => Direction == GoalDirection.Loss ? current <= GoalWeightKg : current >= GoalWeightKg;
}

public sealed class WeighIn
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public decimal WeightKg { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Streak
{
    public Guid UserId { get; set; }
    public int Current { get; set; }
    public int Longest { get; set; }
    public DateOnly? LastLoggedDate { get; set; }
}

public sealed class Milestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public BadgeType Type { get; set; }
    public DateTimeOffset EarnedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? AcknowledgedAt { get; set; }
}

public sealed class RefreshSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedById { get; set; }
    public string? UserAgent { get; set; }
    public string? SourceIp { get; set; }
}

public sealed class OneTimeToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string Purpose { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
}

public sealed class SyncChange
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public SyncEntityType EntityType { get; set; }
    public Guid EntityId { get; set; }
    public ChangeKind Kind { get; set; }
    public DateTimeOffset ServerTimestamp { get; set; } = DateTimeOffset.UtcNow;
    public string? PayloadJson { get; set; }
}

public sealed class AuditRecord
{
    public long Id { get; set; }
    public Guid? ActorId { get; set; }
    public required string Action { get; set; }
    public string? Source { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public string? MetadataJson { get; set; }
}

public sealed class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string Endpoint { get; set; }
    public required string P256dh { get; set; }
    public required string Auth { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class WeightMath
{
    public const decimal PoundsPerKilogram = 2.2046226218m;
    public static decimal ToKilograms(decimal value, WeightUnit unit) => Math.Round(unit == WeightUnit.Kg ? value : value / PoundsPerKilogram, unit == WeightUnit.Kg ? 1 : 3, MidpointRounding.AwayFromZero);
    public static decimal FromKilograms(decimal value, WeightUnit unit) => Math.Round(unit == WeightUnit.Kg ? value : value * PoundsPerKilogram, 1, MidpointRounding.AwayFromZero);
    public static decimal PercentComplete(decimal start, decimal goal, decimal current)
    {
        if (start == goal) return 100m;
        return Math.Clamp(Math.Round((start - current) / (start - goal) * 100m, 1), 0m, 100m);
    }
    public static decimal Bmi(decimal kg, decimal cm) => cm <= 0 ? 0 : Math.Round(kg / ((cm / 100m) * (cm / 100m)), 1);
}

public static class StreakCalculator
{
    public static (int Current, int Longest) Calculate(IEnumerable<DateOnly> source, DateOnly today, int priorLongest = 0)
    {
        var dates = source.Distinct().OrderBy(x => x).ToArray();
        var longest = 0;
        var run = 0;
        DateOnly? previous = null;
        foreach (var date in dates)
        {
            run = previous is not null && date.DayNumber == previous.Value.DayNumber + 1 ? run + 1 : 1;
            longest = Math.Max(longest, run);
            previous = date;
        }
        var cursor = dates.Contains(today) ? today : today.AddDays(-1);
        var set = dates.ToHashSet();
        var current = 0;
        while (set.Contains(cursor)) { current++; cursor = cursor.AddDays(-1); }
        return (current, Math.Max(priorLongest, longest));
    }
}

public sealed record PaceProjection(decimal WeeklyRateKg, DateOnly? ProjectedDate, ScheduleStatus? Status, int? DayDelta, string Message);

public static class TrendCalculator
{
    public static PaceProjection Project(IReadOnlyCollection<WeighIn> values, Goal goal, DateOnly today)
    {
        var recent = values.OrderBy(x => x.Date).Where(x => x.Date >= today.AddDays(-27)).ToArray();
        if (recent.Length < 2 || recent[^1].Date.DayNumber - recent[0].Date.DayNumber < 7)
            return new(0, null, null, null, "Keep logging to see your pace");
        var origin = recent[0].Date.DayNumber;
        var xs = recent.Select(x => (decimal)(x.Date.DayNumber - origin)).ToArray();
        var ys = recent.Select(x => x.WeightKg).ToArray();
        var xMean = xs.Average(); var yMean = ys.Average();
        var denominator = xs.Sum(x => (x - xMean) * (x - xMean));
        var daily = denominator == 0 ? 0 : xs.Zip(ys).Sum(p => (p.First - xMean) * (p.Second - yMean)) / denominator;
        var weekly = Math.Round(daily * 7m, 2);
        var towardGoal = goal.Direction == GoalDirection.Loss ? daily < 0 : daily > 0;
        if (!towardGoal) return new(weekly, null, null, null, "Your recent trend is not currently moving toward the goal");
        var remaining = goal.GoalWeightKg - recent[^1].WeightKg;
        var days = (int)Math.Ceiling(remaining / daily);
        if (days < 0) return new(weekly, today, ScheduleStatus.Ahead, goal.TargetDate.DayNumber - today.DayNumber, "Goal reached");
        var projected = today.AddDays(days);
        var delta = projected.DayNumber - goal.TargetDate.DayNumber;
        var status = Math.Abs(delta) <= 7 ? ScheduleStatus.OnTrack : delta < 0 ? ScheduleStatus.Ahead : ScheduleStatus.Behind;
        return new(weekly, projected, status, Math.Abs(delta), status == ScheduleStatus.OnTrack ? "On track" : status == ScheduleStatus.Ahead ? "Ahead of schedule" : "Behind schedule");
    }
}
