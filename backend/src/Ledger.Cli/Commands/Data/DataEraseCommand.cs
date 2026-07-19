using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Data;

public static class DataEraseCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var confirm = new Option<string>("--confirm") { Description = "Repeat the exact email address to confirm permanent application-data erasure.", Required = true };
        var command = new Command("erase", "Erase goals, weigh-ins, progress, onboarding, and synchronization data while retaining the account.");
        command.Options.Add(email); command.Options.Add(confirm);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<DataEraseHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), parseResult.GetRequiredValue(confirm), token)));
        return command;
    }
}

public sealed class DataEraseHandler(LedgerDbContext db, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, string confirmation, CancellationToken ct)
    {
        if (!string.Equals(email.Trim(), confirmation.Trim(), StringComparison.Ordinal))
            throw new CliException("Confirmation does not exactly match the email address.", "confirmation_failed", 2);
        var user = await Commands.Users.UserLookup.ActiveByEmailAsync(db, email, ct);
        var id = user.Id;
        var removed = new
        {
            syncChanges = await db.SyncChanges.Where(x => x.UserId == id).ExecuteDeleteAsync(ct),
            milestones = await db.Milestones.Where(x => x.UserId == id).ExecuteDeleteAsync(ct),
            weighIns = await db.WeighIns.Where(x => x.UserId == id).ExecuteDeleteAsync(ct),
            goals = await db.Goals.Where(x => x.UserId == id).ExecuteDeleteAsync(ct),
            streaks = await db.Streaks.Where(x => x.UserId == id).ExecuteDeleteAsync(ct),
            onboardingDrafts = await db.OnboardingDrafts.Where(x => x.UserId == id).ExecuteDeleteAsync(ct)
        };
        db.AuditRecords.Add(new AuditRecord { ActorId = id, Action = "cli.data_erased", Source = "ledger-cli", Timestamp = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        output.Write($"Erased application data for {user.Email}; the account remains active.", new { success = true, userId = id, removed });
    }
}
