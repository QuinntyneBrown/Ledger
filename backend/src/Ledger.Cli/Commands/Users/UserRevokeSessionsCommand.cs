using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserRevokeSessionsCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var command = new Command("revoke-sessions", "Sign a member out from every device.");
        command.Options.Add(email);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserRevokeSessionsHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), token)));
        return command;
    }
}

public sealed class UserRevokeSessionsHandler(LedgerDbContext db, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, CancellationToken ct)
    {
        var user = await UserLookup.ActiveByEmailAsync(db, email, ct);
        var now = clock.UtcNow;
        var sessions = await db.RefreshSessions.Where(x => x.UserId == user.Id && x.RevokedAt == null).ToListAsync(ct);
        foreach (var session in sessions) session.RevokedAt = now;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.sessions_revoked", Source = "ledger-cli", Timestamp = now });
        await db.SaveChangesAsync(ct);
        output.Write($"Revoked {sessions.Count} active session(s) for {user.Email}.", new { success = true, userId = user.Id, revokedSessions = sessions.Count });
    }
}
