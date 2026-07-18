using System.Globalization;
using System.Text;
using Ledger.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Application;

public sealed record GoalProgressView(decimal PercentComplete, decimal StartWeightKg, decimal CurrentWeightKg, decimal GoalWeightKg, decimal RemainingKg, bool Reached, bool HasSufficientData, PaceProjection Pace);
public sealed record GetGoalProgressQuery : IRequest<GoalProgressView>;
public sealed class GetGoalProgressHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock) : IRequestHandler<GetGoalProgressQuery, GoalProgressView>
{
    public async Task<GoalProgressView> Handle(GetGoalProgressQuery r, CancellationToken ct)
    {
        var goal = await db.Goals.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct) ?? throw AppProblem.NotFound();
        var entries = await db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId).OrderBy(x => x.Date).ToListAsync(ct); if (entries.Count == 0) throw AppProblem.NotFound();
        var prefs = await db.Preferences.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct); var pace = TrendCalculator.Project(entries, goal, clock.Today(prefs.TimeZone)); var current = entries[^1].WeightKg;
        return new(goal.PercentComplete(current), goal.StartWeightKg, current, goal.GoalWeightKg, goal.RemainingKg(current), goal.IsReached(current), pace.ProjectedDate is not null, pace);
    }
}

public sealed record DashboardView(string Greeting, GoalProgressView Progress, decimal ThisWeekChangeKg, decimal AverageWeeklyChangeKg, int CurrentStreak, IReadOnlyList<WeighInDto> Trend, BadgeType? NextBadge, IReadOnlyList<BadgeType> Celebrations);
public sealed record GetDashboardQuery : IRequest<DashboardView>;
public sealed class GetDashboardHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock) : IRequestHandler<GetDashboardQuery, DashboardView>
{
    public async Task<DashboardView> Handle(GetDashboardQuery r, CancellationToken ct)
    {
        var owner = await db.Users.AsNoTracking().SingleAsync(x => x.Id == user.UserId, ct); var goal = await db.Goals.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct) ?? throw new AppProblem(409, "onboarding_required", "Complete onboarding first.");
        var entries = await db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId).OrderBy(x => x.Date).ToListAsync(ct); var prefs = await db.Preferences.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct); var today = clock.Today(prefs.TimeZone); var current = entries[^1].WeightKg; var pace = TrendCalculator.Project(entries, goal, today);
        var progress = new GoalProgressView(goal.PercentComplete(current), goal.StartWeightKg, current, goal.GoalWeightKg, goal.RemainingKg(current), goal.IsReached(current), pace.ProjectedDate is not null, pace);
        var week = entries.Where(x => x.Date >= today.AddDays(-7)).ToArray(); var weekChange = week.Length < 2 ? 0 : week[^1].WeightKg - week[0].WeightKg;
        var span = Math.Max(1, entries[^1].Date.DayNumber - entries[0].Date.DayNumber); var avg = entries.Count < 2 ? 0 : Math.Round((entries[^1].WeightKg - entries[0].WeightKg) / span * 7m, 2);
        var streak = await db.Streaks.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct); var earned = await db.Milestones.AsNoTracking().Where(x => x.UserId == user.UserId).Select(x => x.Type).ToListAsync(ct); var celebrations = await db.Milestones.AsNoTracking().Where(x => x.UserId == user.UserId && x.AcknowledgedAt == null).Select(x => x.Type).ToListAsync(ct);
        var next = Enum.GetValues<BadgeType>().FirstOrDefault(x => !earned.Contains(x)); return new($"Welcome back, {owner.Name.Split(' ')[0]}", progress, weekChange, avg, streak?.Current ?? 0, entries.Where(x => x.Date >= today.AddDays(-29)).Select(ApplicationRules.ToDto).ToArray(), earned.Count == 8 ? null : next, celebrations);
    }
}

public enum TimeRange { OneWeek, OneMonth, ThreeMonths, SixMonths, OneYear, All }
public sealed record TrendPoint(DateOnly Date, decimal WeightKg, decimal MovingAverageKg, decimal LowKg, decimal HighKg);
public sealed record TrendsView(IReadOnlyList<TrendPoint> Series, decimal GoalWeightKg, decimal RatePerWeekKg, decimal TotalChangeKg, decimal BestWeekKg, decimal? Bmi, IReadOnlyList<Milestone> Annotations, IReadOnlyList<WeighInDto> RecentEntries, string AccessibleDescription);
public sealed record GetTrendsQuery(TimeRange Range) : IRequest<TrendsView>;
public sealed class GetTrendsHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock) : IRequestHandler<GetTrendsQuery, TrendsView>
{
    public async Task<TrendsView> Handle(GetTrendsQuery r, CancellationToken ct)
    {
        var goal = await db.Goals.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct); var prefs = await db.Preferences.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct); var today = clock.Today(prefs.TimeZone);
        var days = r.Range switch { TimeRange.OneWeek => 7, TimeRange.OneMonth => 30, TimeRange.ThreeMonths => 90, TimeRange.SixMonths => 183, TimeRange.OneYear => 365, _ => int.MaxValue };
        var q = db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId); if (days != int.MaxValue) q = q.Where(x => x.Date >= today.AddDays(-days + 1)); var entries = await q.OrderBy(x => x.Date).ToListAsync(ct);
        var points = entries.Select((x, i) => { var window = entries.Skip(Math.Max(0, i - 6)).Take(Math.Min(7, i + 1)).Select(v => v.WeightKg).ToArray(); return new TrendPoint(x.Date, x.WeightKg, Math.Round(window.Average(), 1), window.Min(), window.Max()); }).ToArray();
        var total = entries.Count < 2 ? 0 : entries[^1].WeightKg - entries[0].WeightKg; var span = entries.Count < 2 ? 1 : Math.Max(1, entries[^1].Date.DayNumber - entries[0].Date.DayNumber); var rate = Math.Round(total / span * 7m, 2);
        var best = entries.Count < 2 ? 0 : entries.Skip(1).Select((x, i) => x.WeightKg - entries[i].WeightKg).Min(); var owner = await db.Users.AsNoTracking().SingleAsync(x => x.Id == user.UserId, ct); decimal? bmi = owner.HeightCm is null || entries.Count == 0 ? null : WeightMath.Bmi(entries[^1].WeightKg, owner.HeightCm.Value);
        var milestones = await db.Milestones.AsNoTracking().Where(x => x.UserId == user.UserId).ToListAsync(ct); var text = entries.Count == 0 ? "No weight data in this range." : $"Weight changed from {entries[0].WeightKg} to {entries[^1].WeightKg} kilograms across {entries.Count} entries.";
        return new(points, goal.GoalWeightKg, rate, total, best, bmi, milestones, entries.TakeLast(5).Reverse().Select(ApplicationRules.ToDto).ToArray(), text);
    }
}

public sealed record BadgeView(BadgeType Type, bool Earned, DateTimeOffset? EarnedAt, decimal Progress, string Remaining, bool CelebrationPending);
public sealed record GetBadgesQuery : IRequest<IReadOnlyList<BadgeView>>;
public sealed class GetBadgesHandler(ILedgerDbContext db, IUserContext user) : IRequestHandler<GetBadgesQuery, IReadOnlyList<BadgeView>>
{
    public async Task<IReadOnlyList<BadgeView>> Handle(GetBadgesQuery r, CancellationToken ct)
    {
        var entries = await db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId).OrderBy(x => x.Date).ToListAsync(ct); var goal = await db.Goals.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct); var streak = await db.Streaks.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct); var earned = await db.Milestones.AsNoTracking().Where(x => x.UserId == user.UserId).ToDictionaryAsync(x => x.Type, ct);
        return Enum.GetValues<BadgeType>().Select(type => { earned.TryGetValue(type, out var m); var (progress, remaining) = BadgeProgress(type, entries, goal, streak); return new BadgeView(type, m is not null, m?.EarnedAt, m is not null ? 100 : progress, m is not null ? "Earned" : remaining, m is not null && m.AcknowledgedAt is null); }).ToArray();
    }
    private static (decimal, string) BadgeProgress(BadgeType type, IReadOnlyList<WeighIn> entries, Goal? goal, Streak? streak)
    {
        var target = type switch { BadgeType.FirstEntry => 1m, BadgeType.SevenDayStreak => 7m, BadgeType.ThirtyDayStreak => 30m, BadgeType.HundredEntries => 100m, BadgeType.OneKg => 1m, BadgeType.TwoPointFiveKg => 2.5m, BadgeType.FiveKg => 5m, _ => 100m };
        decimal value = type switch { BadgeType.FirstEntry or BadgeType.HundredEntries => entries.Count, BadgeType.SevenDayStreak or BadgeType.ThirtyDayStreak => streak?.Longest ?? 0, BadgeType.GoalReached => goal?.ReachedAt is null ? 0 : 100, _ => goal is null || entries.Count == 0 ? 0 : Math.Max(0, goal.StartWeightKg - entries.Min(x => x.WeightKg)) };
        return (Math.Clamp(value / target * 100m, 0, 100), type is BadgeType.OneKg or BadgeType.TwoPointFiveKg or BadgeType.FiveKg ? $"{Math.Max(0, target - value):0.0} kg to go" : $"{value:0} / {target:0}");
    }
}

public sealed record UpdateProfileCommand(string Name, string Email, decimal? HeightCm) : IRequest;
public sealed class UpdateProfileHandler(ILedgerDbContext db, IUserContext current, ITokenService tokens, IEmailSender email, IAppLinks links, ILocalDate clock) : IRequestHandler<UpdateProfileCommand>
{
    public async Task Handle(UpdateProfileCommand r, CancellationToken ct)
    {
        if (r.HeightCm is < 50m or > 272m) throw AppProblem.Validation("heightCm", "Height must be between 50 and 272 cm."); var user = await db.Users.SingleAsync(x => x.Id == current.UserId, ct); user.Name = r.Name.Trim(); var normalized = ApplicationRules.NormalizeEmail(r.Email);
        if (normalized != user.NormalizedEmail) { if (await db.Users.AnyAsync(x => x.NormalizedEmail == normalized && x.Id != user.Id, ct)) throw AppProblem.Validation("email", "That email is already in use."); user.Email = r.Email.Trim(); user.NormalizedEmail = normalized; user.EmailVerified = false; var raw = tokens.CreateOpaqueToken(); db.OneTimeTokens.Add(new OneTimeToken { UserId = user.Id, Purpose = "verify-email", TokenHash = tokens.HashToken(raw), ExpiresAt = clock.UtcNow.AddHours(24) }); await email.SendAsync(user.Email, "Verify your new Ledger email", $"Verify your email: {links.VerifyEmail(raw)}", ct); }
        user.HeightCm = r.HeightCm; db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "profile.updated" }); await db.SaveChangesAsync(ct);
    }
}

public sealed record ScheduleReminderCommand(bool Enabled, TimeOnly Time, bool QuietHoursEnabled, TimeOnly QuietHoursStart, TimeOnly QuietHoursEnd, string TimeZone) : IRequest<PreferenceDto>;
public sealed class ScheduleReminderHandler(ILedgerDbContext db, IUserContext user) : IRequestHandler<ScheduleReminderCommand, PreferenceDto>
{
    public async Task<PreferenceDto> Handle(ScheduleReminderCommand r, CancellationToken ct) { var p = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); p.ReminderEnabled = r.Enabled; p.ReminderTime = r.Time; p.QuietHoursEnabled = r.QuietHoursEnabled; p.QuietHoursStart = r.QuietHoursStart; p.QuietHoursEnd = r.QuietHoursEnd; p.TimeZone = r.TimeZone; await db.SaveChangesAsync(ct); return p.ToDto(); }
}

public sealed record ExportDataQuery : IRequest<byte[]>;
public sealed class ExportDataHandler(ILedgerDbContext db, IUserContext user) : IRequestHandler<ExportDataQuery, byte[]>
{
    public async Task<byte[]> Handle(ExportDataQuery r, CancellationToken ct)
    {
        var prefs = await db.Preferences.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct); var entries = await db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId).OrderBy(x => x.Date).ToListAsync(ct); var sb = new StringBuilder("date,weight_kg,display_weight,unit,note\r\n");
        foreach (var e in entries) sb.Append(Csv(e.Date.ToString("O", CultureInfo.InvariantCulture))).Append(',').Append(e.WeightKg.ToString(CultureInfo.InvariantCulture)).Append(',').Append(WeightMath.FromKilograms(e.WeightKg, prefs.Unit).ToString(CultureInfo.InvariantCulture)).Append(',').Append(prefs.Unit).Append(',').Append(Csv(e.Note ?? string.Empty)).Append("\r\n");
        db.AuditRecords.Add(new AuditRecord { ActorId = user.UserId, Action = "data.exported" }); await db.SaveChangesAsync(ct); return Encoding.UTF8.GetBytes(sb.ToString());
    }
    private static string Csv(string value) { if (value.Length > 0 && "=+-@\t\r".Contains(value[0])) value = "'" + value; return '"' + value.Replace("\"", "\"\"") + '"'; }
}
