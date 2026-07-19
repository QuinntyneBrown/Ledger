using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserDeleteCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var confirm = new Option<string>("--confirm") { Description = "Repeat the exact email address to confirm permanent account-data erasure.", Required = true };
        var command = new Command("delete", "Erase a member's data and anonymize the account.");
        command.Options.Add(email); command.Options.Add(confirm);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserDeleteHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), parseResult.GetRequiredValue(confirm), token)));
        return command;
    }
}

public sealed class UserDeleteHandler(LedgerDbContext db, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, string confirmation, CancellationToken ct)
    {
        if (!string.Equals(email.Trim(), confirmation.Trim(), StringComparison.Ordinal))
            throw new CliException("Confirmation does not exactly match the email address.", "confirmation_failed", 2);
        var user = await UserLookup.ActiveByEmailAsync(db, email, ct);
        var id = user.Id;
        await db.PushSubscriptions.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.SyncChanges.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.Milestones.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.WeighIns.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.Goals.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.Streaks.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.OnboardingDrafts.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.RefreshSessions.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.OneTimeTokens.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        await db.Preferences.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
        user.Name = "Deleted member"; user.Email = $"deleted-{id:N}@invalid.local"; user.NormalizedEmail = user.Email.ToUpperInvariant();
        user.PasswordHash = "deleted"; user.AvatarUrl = null; user.HeightCm = null; user.IsDeleted = true; user.LockedUntil = null;
        db.AuditRecords.Add(new AuditRecord { ActorId = null, Action = "cli.account_deleted", Source = "ledger-cli", Timestamp = clock.UtcNow, MetadataJson = $"{{\"userId\":\"{id}\"}}" });
        await db.SaveChangesAsync(ct);
        output.Write($"Erased and anonymized account {id}.", new { success = true, userId = id, deleted = true });
    }
}
