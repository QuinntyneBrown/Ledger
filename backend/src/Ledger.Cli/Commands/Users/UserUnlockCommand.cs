using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserUnlockCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var command = new Command("unlock", "Clear failed sign-in attempts and account lockout.");
        command.Options.Add(email);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserUnlockHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), token)));
        return command;
    }
}

public sealed class UserUnlockHandler(LedgerDbContext db, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, CancellationToken ct)
    {
        var user = await UserLookup.ActiveByEmailAsync(db, email, ct);
        user.FailedLoginCount = 0; user.LockedUntil = null;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.user_unlocked", Source = "ledger-cli", Timestamp = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        output.Write($"Unlocked {user.Email}.", new { success = true, userId = user.Id, user.Email });
    }
}
