using Ledger.Application;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.CommandLine;

namespace Ledger.Cli.Commands.Maintenance;

public static class MaintenancePruneCommand
{
    public static Command Create()
    {
        var dryRun = new Option<bool>("--dry-run") { Description = "Report eligible records without deleting them." };
        var syncDays = new Option<int?>("--sync-retention-days") { Description = "Override synchronization feed retention in days." };
        var securityDays = new Option<int?>("--security-retention-days") { Description = "Override expired token/session retention in days." };
        var command = new Command("prune", "Delete expired synchronization records, one-time tokens, and refresh sessions.");
        command.Options.Add(dryRun); command.Options.Add(syncDays); command.Options.Add(securityDays);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<MaintenancePruneHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(
            parseResult.GetValue(dryRun), parseResult.GetValue(syncDays), parseResult.GetValue(securityDays), token)));
        return command;
    }
}

public sealed class MaintenancePruneHandler(LedgerDbContext db, ILocalDate clock, IOptions<MaintenanceOptions> options, ICliOutput output)
{
    public async Task ExecuteAsync(bool dryRun, int? syncRetentionDays, int? securityRetentionDays, CancellationToken ct)
    {
        var syncDays = syncRetentionDays ?? options.Value.SyncRetentionDays;
        var securityDays = securityRetentionDays ?? options.Value.ExpiredSecurityDataRetentionDays;
        if (syncDays < 1 || securityDays < 1) throw new CliException("Retention periods must be at least one day.", "validation_failed", 2);
        var now = clock.UtcNow;
        var syncCutoff = now.AddDays(-syncDays);
        var securityCutoff = now.AddDays(-securityDays);
        var syncQuery = db.SyncChanges.Where(x => x.ServerTimestamp < syncCutoff);
        var tokenQuery = db.OneTimeTokens.Where(x => x.ExpiresAt < securityCutoff || (x.ConsumedAt != null && x.ConsumedAt < securityCutoff));
        var sessionQuery = db.RefreshSessions.Where(x => x.ExpiresAt < securityCutoff || (x.RevokedAt != null && x.RevokedAt < securityCutoff));
        if (dryRun)
        {
            // Client-side comparison keeps dry-run diagnostics usable with lightweight relational providers too.
            var syncDates = await db.SyncChanges.AsNoTracking().Select(x => x.ServerTimestamp).ToListAsync(ct);
            var tokenDates = await db.OneTimeTokens.AsNoTracking().Select(x => new { x.ExpiresAt, x.ConsumedAt }).ToListAsync(ct);
            var sessionDates = await db.RefreshSessions.AsNoTracking().Select(x => new { x.ExpiresAt, x.RevokedAt }).ToListAsync(ct);
            var preview = new
            {
                syncChanges = syncDates.Count(x => x < syncCutoff),
                oneTimeTokens = tokenDates.Count(x => x.ExpiresAt < securityCutoff || x.ConsumedAt < securityCutoff),
                refreshSessions = sessionDates.Count(x => x.ExpiresAt < securityCutoff || x.RevokedAt < securityCutoff)
            };
            output.Write($"Would prune {preview.syncChanges} sync change(s), {preview.oneTimeTokens} token(s), and {preview.refreshSessions} session(s).",
                new { success = true, dryRun, retention = new { syncDays, securityDays }, records = preview });
            return;
        }
        var eligible = new
        {
            syncChanges = await syncQuery.CountAsync(ct),
            oneTimeTokens = await tokenQuery.CountAsync(ct),
            refreshSessions = await sessionQuery.CountAsync(ct)
        };
        await syncQuery.ExecuteDeleteAsync(ct);
        await tokenQuery.ExecuteDeleteAsync(ct);
        await sessionQuery.ExecuteDeleteAsync(ct);
        output.Write($"Pruned {eligible.syncChanges} sync change(s), {eligible.oneTimeTokens} token(s), and {eligible.refreshSessions} session(s).",
            new { success = true, dryRun = false, retention = new { syncDays, securityDays }, records = eligible });
    }
}
