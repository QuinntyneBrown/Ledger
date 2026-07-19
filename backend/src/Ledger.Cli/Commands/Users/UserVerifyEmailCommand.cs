using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserVerifyEmailCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var command = new Command("verify-email", "Administratively mark a member email as verified.");
        command.Options.Add(email);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserVerifyEmailHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), token)));
        return command;
    }
}

public sealed class UserVerifyEmailHandler(LedgerDbContext db, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, CancellationToken ct)
    {
        var user = await UserLookup.ActiveByEmailAsync(db, email, ct);
        var now = clock.UtcNow;
        user.EmailVerified = true;
        var tokens = await db.OneTimeTokens.Where(x => x.UserId == user.Id && x.Purpose == "verify-email" && x.ConsumedAt == null).ToListAsync(ct);
        foreach (var token in tokens) token.ConsumedAt = now;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.email_verified", Source = "ledger-cli", Timestamp = now });
        await db.SaveChangesAsync(ct);
        output.Write($"Verified {user.Email}.", new { success = true, userId = user.Id, user.Email });
    }
}
