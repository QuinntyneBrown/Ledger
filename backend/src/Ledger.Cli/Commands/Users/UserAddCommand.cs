using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserAddCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var name = new Option<string>("--name") { Description = "Member display name.", Required = true };
        var password = new Option<string?>("--password") { Description = "Initial password. Prefer LEDGER_CLI_PASSWORD to keep it out of shell history." };
        var unverified = new Option<bool>("--unverified") { Description = "Create the member without marking the email as verified." };
        var command = new Command("add", "Create a member account and default preferences.");
        command.Options.Add(email); command.Options.Add(name); command.Options.Add(password); command.Options.Add(unverified);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserAddHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(
            parseResult.GetRequiredValue(email), parseResult.GetRequiredValue(name), parseResult.GetValue(password), !parseResult.GetValue(unverified), token)));
        return command;
    }
}

public sealed class UserAddHandler(LedgerDbContext db, IPasswordService passwords, IPasswordInput passwordInput, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, string name, string? suppliedPassword, bool verified, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new CliException("Name is required.", "validation_failed", 2);
        var normalized = ApplicationRules.NormalizeEmail(email);
        if (await db.Users.AnyAsync(x => x.NormalizedEmail == normalized, ct))
            throw new CliException("A member, including a deleted member, already uses that email.", "email_in_use", 3);
        var password = passwordInput.Read(suppliedPassword);
        try { ApplicationRules.ValidatePassword(password); }
        catch (AppProblem ex) { throw new CliException(ex.Errors.SelectMany(x => x.Value).FirstOrDefault() ?? ex.Message, ex.Code, 2); }
        var user = new User
        {
            Name = name.Trim(), Email = email.Trim(), NormalizedEmail = normalized,
            PasswordHash = passwords.Hash(password), EmailVerified = verified, MemberSince = clock.UtcNow
        };
        db.Users.Add(user);
        db.Preferences.Add(new Preferences { UserId = user.Id });
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.user_created", Source = "ledger-cli", Timestamp = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        output.Write($"Created member {user.Email} ({user.Id}).", new { success = true, userId = user.Id, user.Email, user.Name, user.EmailVerified });
    }
}
