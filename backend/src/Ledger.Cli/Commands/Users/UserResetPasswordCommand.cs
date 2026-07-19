using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserResetPasswordCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var password = new Option<string?>("--password") { Description = "New password. Prefer LEDGER_CLI_PASSWORD to keep it out of shell history." };
        var command = new Command("reset-password", "Set a new password, unlock the member, and revoke all sessions.");
        command.Options.Add(email); command.Options.Add(password);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserResetPasswordHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), parseResult.GetValue(password), token)));
        return command;
    }
}

public sealed class UserResetPasswordHandler(LedgerDbContext db, IPasswordService passwords, IPasswordInput passwordInput, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, string? suppliedPassword, CancellationToken ct)
    {
        var user = await UserLookup.ActiveByEmailAsync(db, email, ct);
        var password = passwordInput.Read(suppliedPassword);
        try { ApplicationRules.ValidatePassword(password); }
        catch (AppProblem ex) { throw new CliException(ex.Errors.SelectMany(x => x.Value).FirstOrDefault() ?? ex.Message, ex.Code, 2); }
        var now = clock.UtcNow;
        user.PasswordHash = passwords.Hash(password); user.PasswordUpdatedAt = now; user.FailedLoginCount = 0; user.LockedUntil = null;
        var sessions = await db.RefreshSessions.Where(x => x.UserId == user.Id && x.RevokedAt == null).ToListAsync(ct);
        foreach (var session in sessions) session.RevokedAt = now;
        var tokens = await db.OneTimeTokens.Where(x => x.UserId == user.Id && x.Purpose == "password-reset" && x.ConsumedAt == null).ToListAsync(ct);
        foreach (var token in tokens) token.ConsumedAt = now;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.password_reset", Source = "ledger-cli", Timestamp = now });
        await db.SaveChangesAsync(ct);
        output.Write($"Reset password for {user.Email} and revoked {sessions.Count} active session(s).", new { success = true, userId = user.Id, revokedSessions = sessions.Count });
    }
}
