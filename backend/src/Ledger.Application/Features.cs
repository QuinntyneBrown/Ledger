using System.Text.Json;
using Ledger.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Application;

public sealed record OnboardingStatus(bool Complete, OnboardingDraft? Draft);
public sealed record GetOnboardingQuery : IRequest<OnboardingStatus>;
public sealed class GetOnboardingHandler(ILedgerDbContext db, IUserContext user) : IRequestHandler<GetOnboardingQuery, OnboardingStatus>
{
    public async Task<OnboardingStatus> Handle(GetOnboardingQuery r, CancellationToken ct) => new(await db.Goals.AnyAsync(x => x.UserId == user.UserId, ct), await db.OnboardingDrafts.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct));
}
public sealed record SaveOnboardingDraftCommand(int LastCompletedStep, WeightUnit? Unit, decimal? CurrentWeightKg, decimal? GoalWeightKg, DateOnly? TargetDate) : IRequest<OnboardingDraft>;
public sealed class SaveOnboardingDraftHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock) : IRequestHandler<SaveOnboardingDraftCommand, OnboardingDraft>
{
    public async Task<OnboardingDraft> Handle(SaveOnboardingDraftCommand r, CancellationToken ct)
    {
        var d = await db.OnboardingDrafts.SingleOrDefaultAsync(x => x.UserId == user.UserId, ct);
        if (d is null) { d = new OnboardingDraft { UserId = user.UserId }; db.OnboardingDrafts.Add(d); }
        d.LastCompletedStep = Math.Clamp(r.LastCompletedStep, 0, 4); d.Unit = r.Unit; d.CurrentWeightKg = r.CurrentWeightKg; d.GoalWeightKg = r.GoalWeightKg; d.TargetDate = r.TargetDate; d.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct); return d;
    }
}
public sealed record CompleteOnboardingCommand(WeightUnit Unit, decimal CurrentWeightKg, decimal GoalWeightKg, DateOnly TargetDate, string TimeZone) : IRequest<GoalDto>;
public sealed class CompleteOnboardingHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock) : IRequestHandler<CompleteOnboardingCommand, GoalDto>
{
    public async Task<GoalDto> Handle(CompleteOnboardingCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidateWeight(r.CurrentWeightKg); ApplicationRules.ValidateWeight(r.GoalWeightKg);
        if (r.CurrentWeightKg == r.GoalWeightKg) throw AppProblem.Validation("goalWeightKg", "Goal weight must differ from current weight.");
        var today = clock.Today(r.TimeZone); if (r.TargetDate <= today) throw AppProblem.Validation("targetDate", "Target date must be after today.");
        if (await db.Goals.AnyAsync(x => x.UserId == user.UserId, ct)) throw new AppProblem(409, "already_onboarded", "Onboarding is already complete.");
        var goal = new Goal { UserId = user.UserId, StartWeightKg = r.CurrentWeightKg, GoalWeightKg = r.GoalWeightKg, TargetDate = r.TargetDate };
        db.Goals.Add(goal); db.WeighIns.Add(new WeighIn { UserId = user.UserId, Date = today, WeightKg = r.CurrentWeightKg });
        var prefs = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); prefs.Unit = r.Unit; prefs.TimeZone = r.TimeZone;
        var draft = await db.OnboardingDrafts.SingleOrDefaultAsync(x => x.UserId == user.UserId, ct); if (draft is not null) db.OnboardingDrafts.Remove(draft);
        await db.SaveChangesAsync(ct);
        await DerivedState.RecomputeAsync(db, user.UserId, today, clock.UtcNow, ct);
        return goal.ToDto();
    }
}

public sealed record LogWeighInCommand(DateOnly Date, decimal WeightKg, string? Note) : IRequest<LogWeighInResult>;
public sealed record LogWeighInResult(WeighInDto Entry, WeighInDto? Previous, bool Created, IReadOnlyList<BadgeType> EarnedBadges);
public sealed class LogWeighInHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock, IRealtimeNotifier realtime, ILedgerMetrics metrics) : IRequestHandler<LogWeighInCommand, LogWeighInResult>
{
    public async Task<LogWeighInResult> Handle(LogWeighInCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidateWeight(r.WeightKg); if (r.Note?.Length > 280) throw AppProblem.Validation("note", "Note cannot exceed 280 characters.");
        var prefs = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); if (r.Date > clock.Today(prefs.TimeZone)) throw AppProblem.Validation("date", "Future dates can't be logged.");
        var entry = await db.WeighIns.SingleOrDefaultAsync(x => x.UserId == user.UserId && x.Date == r.Date, ct); var created = entry is null; WeighInDto? previous = entry?.ToDto();
        if (entry is null) { entry = new WeighIn { UserId = user.UserId, Date = r.Date, WeightKg = r.WeightKg, Note = r.Note?.Trim() }; db.WeighIns.Add(entry); }
        else { entry.WeightKg = r.WeightKg; entry.Note = r.Note?.Trim(); entry.UpdatedAt = clock.UtcNow; }
        await db.SaveChangesAsync(ct);
        var earned = await DerivedState.RecomputeAsync(db, user.UserId, clock.Today(prefs.TimeZone), clock.UtcNow, ct);
        var kind = created ? ChangeKind.Created : ChangeKind.Updated; var dto = entry.ToDto();
        db.SyncChanges.Add(new SyncChange { UserId = user.UserId, EntityType = SyncEntityType.WeighIn, EntityId = entry.Id, Kind = kind, PayloadJson = JsonSerializer.Serialize(dto), ServerTimestamp = clock.UtcNow });
        await db.SaveChangesAsync(ct); metrics.RecordWeighIn(earned.Count); await realtime.SendAsync(user.UserId, new { entityType = "weighIn", kind, data = dto, serverTimestamp = clock.UtcNow }, ct);
        return new(dto, previous, created, earned);
    }
}

public sealed record EditWeighInCommand(Guid Id, decimal WeightKg, string? Note) : IRequest<WeighInDto>;
public sealed class EditWeighInHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock, IRealtimeNotifier realtime) : IRequestHandler<EditWeighInCommand, WeighInDto>
{
    public async Task<WeighInDto> Handle(EditWeighInCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidateWeight(r.WeightKg); if (r.Note?.Length > 280) throw AppProblem.Validation("note", "Note cannot exceed 280 characters.");
        var entry = await db.WeighIns.SingleOrDefaultAsync(x => x.Id == r.Id && x.UserId == user.UserId, ct) ?? throw AppProblem.NotFound(); entry.WeightKg = r.WeightKg; entry.Note = r.Note?.Trim(); entry.UpdatedAt = clock.UtcNow;
        var prefs = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); await db.SaveChangesAsync(ct); await DerivedState.RecomputeAsync(db, user.UserId, clock.Today(prefs.TimeZone), clock.UtcNow, ct);
        var dto = entry.ToDto(); db.SyncChanges.Add(new SyncChange { UserId = user.UserId, EntityType = SyncEntityType.WeighIn, EntityId = entry.Id, Kind = ChangeKind.Updated, PayloadJson = JsonSerializer.Serialize(dto), ServerTimestamp = clock.UtcNow }); await db.SaveChangesAsync(ct);
        await realtime.SendAsync(user.UserId, new { entityType = "weighIn", kind = ChangeKind.Updated, data = dto, serverTimestamp = clock.UtcNow }, ct); return dto;
    }
}

public sealed record DeleteWeighInCommand(Guid Id) : IRequest<WeighInDto>;
public sealed class DeleteWeighInHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock, IRealtimeNotifier realtime) : IRequestHandler<DeleteWeighInCommand, WeighInDto>
{
    public async Task<WeighInDto> Handle(DeleteWeighInCommand r, CancellationToken ct)
    {
        var entry = await db.WeighIns.SingleOrDefaultAsync(x => x.Id == r.Id && x.UserId == user.UserId, ct) ?? throw AppProblem.NotFound(); var dto = entry.ToDto(); db.WeighIns.Remove(entry);
        var prefs = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); await db.SaveChangesAsync(ct); await DerivedState.RecomputeAsync(db, user.UserId, clock.Today(prefs.TimeZone), clock.UtcNow, ct);
        db.SyncChanges.Add(new SyncChange { UserId = user.UserId, EntityType = SyncEntityType.WeighIn, EntityId = entry.Id, Kind = ChangeKind.Deleted, ServerTimestamp = clock.UtcNow }); await db.SaveChangesAsync(ct);
        await realtime.SendAsync(user.UserId, new { entityType = "weighIn", kind = ChangeKind.Deleted, id = entry.Id, serverTimestamp = clock.UtcNow }, ct); return dto;
    }
}

public enum HistorySort { Newest, Oldest, BiggestDrop }
public sealed record GetHistoryQuery(HistorySort Sort = HistorySort.Newest, int Page = 1, int PageSize = 50) : IRequest<HistoryResult>;
public sealed record HistoryMonth(int Year, int Month, decimal NetChangeKg, IReadOnlyList<WeighInDto> Entries);
public sealed record HistoryResult(int Total, int Page, bool HasMore, IReadOnlyList<HistoryMonth> Months);
public sealed class GetHistoryHandler(ILedgerDbContext db, IUserContext user) : IRequestHandler<GetHistoryQuery, HistoryResult>
{
    public async Task<HistoryResult> Handle(GetHistoryQuery r, CancellationToken ct)
    {
        var size = Math.Clamp(r.PageSize, 1, 100); var page = Math.Max(1, r.Page); var q = db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId);
        var total = await q.CountAsync(ct);
        List<WeighIn> entries;
        if (r.Sort == HistorySort.BiggestDrop)
        {
            entries = await q.Select(x => new { Entry = x, Previous = db.WeighIns.Where(p => p.UserId == user.UserId && p.Date < x.Date).OrderByDescending(p => p.Date).Select(p => (decimal?)p.WeightKg).FirstOrDefault() })
                .OrderBy(x => x.Entry.WeightKg - (x.Previous ?? x.Entry.WeightKg)).ThenByDescending(x => x.Entry.Date).Skip((page - 1) * size).Take(size).Select(x => x.Entry).ToListAsync(ct);
        }
        else
        {
            var ordered = r.Sort == HistorySort.Oldest ? q.OrderBy(x => x.Date) : q.OrderByDescending(x => x.Date);
            entries = await ordered.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        }
        var months = entries.GroupBy(x => new { x.Date.Year, x.Date.Month }).Select(g => { var ordered = g.OrderBy(x => x.Date).ToArray(); return new HistoryMonth(g.Key.Year, g.Key.Month, ordered.Length < 2 ? 0 : ordered[^1].WeightKg - ordered[0].WeightKg, ordered.Select(ApplicationRules.ToDto).ToArray()); }).ToArray();
        return new(total, page, page * size < total, months);
    }
}

public sealed record SetGoalCommand(decimal GoalWeightKg, DateOnly TargetDate) : IRequest<GoalDto>;
public sealed class SetGoalHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock, IRealtimeNotifier realtime) : IRequestHandler<SetGoalCommand, GoalDto>
{
    public async Task<GoalDto> Handle(SetGoalCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidateWeight(r.GoalWeightKg); var prefs = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); if (r.TargetDate <= clock.Today(prefs.TimeZone)) throw AppProblem.Validation("targetDate", "Target date must be after today.");
        var current = await db.WeighIns.Where(x => x.UserId == user.UserId).OrderByDescending(x => x.Date).Select(x => x.WeightKg).FirstAsync(ct); if (current == r.GoalWeightKg) throw AppProblem.Validation("goalWeightKg", "Goal weight must differ from current weight.");
        var goal = await db.Goals.SingleAsync(x => x.UserId == user.UserId, ct); goal.GoalWeightKg = r.GoalWeightKg; goal.TargetDate = r.TargetDate; goal.UpdatedAt = clock.UtcNow; goal.ReachedAt = null; var dto = goal.ToDto();
        db.SyncChanges.Add(new SyncChange { UserId = user.UserId, EntityType = SyncEntityType.Goal, EntityId = goal.Id, Kind = ChangeKind.Updated, PayloadJson = JsonSerializer.Serialize(dto), ServerTimestamp = clock.UtcNow }); await db.SaveChangesAsync(ct);
        await realtime.SendAsync(user.UserId, new { entityType = "goal", kind = ChangeKind.Updated, data = dto, serverTimestamp = clock.UtcNow }, ct); return dto;
    }
}

public sealed record ChangePreferencesCommand(WeightUnit? Unit, ThemePreference? Theme, WeekStart? WeekStartsOn, string? TimeZone) : IRequest<PreferenceDto>;
public sealed class ChangePreferencesHandler(ILedgerDbContext db, IUserContext user, ILocalDate clock, IRealtimeNotifier realtime) : IRequestHandler<ChangePreferencesCommand, PreferenceDto>
{
    public async Task<PreferenceDto> Handle(ChangePreferencesCommand r, CancellationToken ct)
    {
        var p = await db.Preferences.SingleAsync(x => x.UserId == user.UserId, ct); if (r.Unit is not null) p.Unit = r.Unit.Value; if (r.Theme is not null) p.Theme = r.Theme.Value; if (r.WeekStartsOn is not null) p.WeekStartsOn = r.WeekStartsOn.Value; if (!string.IsNullOrWhiteSpace(r.TimeZone)) p.TimeZone = r.TimeZone;
        var dto = p.ToDto(); db.SyncChanges.Add(new SyncChange { UserId = user.UserId, EntityType = SyncEntityType.Preferences, EntityId = user.UserId, Kind = ChangeKind.Updated, PayloadJson = JsonSerializer.Serialize(dto), ServerTimestamp = clock.UtcNow }); await db.SaveChangesAsync(ct); await realtime.SendAsync(user.UserId, new { entityType = "preferences", kind = ChangeKind.Updated, data = dto, serverTimestamp = clock.UtcNow }, ct); return dto;
    }
}

internal static class DerivedState
{
    public static async Task<IReadOnlyList<BadgeType>> RecomputeAsync(ILedgerDbContext db, Guid userId, DateOnly today, DateTimeOffset now, CancellationToken ct)
    {
        var entries = await db.WeighIns.Where(x => x.UserId == userId).OrderBy(x => x.Date).ToListAsync(ct); var streak = await db.Streaks.SingleOrDefaultAsync(x => x.UserId == userId, ct); if (streak is null) { streak = new Streak { UserId = userId }; db.Streaks.Add(streak); }
        var computed = StreakCalculator.Calculate(entries.Select(x => x.Date), today, streak.Longest); streak.Current = computed.Current; streak.Longest = computed.Longest; streak.LastLoggedDate = entries.LastOrDefault()?.Date;
        var goal = await db.Goals.SingleOrDefaultAsync(x => x.UserId == userId, ct); if (goal is not null && entries.Count > 0 && goal.IsReached(entries[^1].WeightKg) && goal.ReachedAt is null) goal.ReachedAt = now;
        var earned = await db.Milestones.Where(x => x.UserId == userId).Select(x => x.Type).ToListAsync(ct); var candidates = new List<BadgeType>();
        if (entries.Count > 0) candidates.Add(BadgeType.FirstEntry); if (streak.Longest >= 7) candidates.Add(BadgeType.SevenDayStreak); if (streak.Longest >= 30) candidates.Add(BadgeType.ThirtyDayStreak); if (entries.Count >= 100) candidates.Add(BadgeType.HundredEntries); if (goal?.ReachedAt is not null) candidates.Add(BadgeType.GoalReached);
        if (goal is not null && goal.Direction == GoalDirection.Loss)
        {
            foreach (var threshold in new[] { (1m, BadgeType.OneKg), (2.5m, BadgeType.TwoPointFiveKg), (5m, BadgeType.FiveKg) }) if (entries.Count(x => goal.StartWeightKg - x.WeightKg >= threshold.Item1) >= 2) candidates.Add(threshold.Item2);
        }
        var newly = candidates.Distinct().Except(earned).ToArray(); foreach (var type in newly) db.Milestones.Add(new Milestone { UserId = userId, Type = type, EarnedAt = now }); await db.SaveChangesAsync(ct); return newly;
    }
}
