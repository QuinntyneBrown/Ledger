using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Database;

public static class DatabaseSeedCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Email for the demo member.", DefaultValueFactory = _ => "demo@ledger.local" };
        var name = new Option<string>("--name") { Description = "Display name for the demo member.", DefaultValueFactory = _ => "Demo Member" };
        var password = new Option<string?>("--password") { Description = "Demo password. Prefer LEDGER_CLI_PASSWORD to keep it out of shell history." };
        var noMigrate = new Option<bool>("--no-migrate") { Description = "Do not apply pending migrations before seeding." };
        var command = new Command("seed", "Create an idempotent demo member with representative goal and weigh-in data.");
        command.Options.Add(email); command.Options.Add(name); command.Options.Add(password); command.Options.Add(noMigrate);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<DatabaseSeedHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(
            parseResult.GetRequiredValue(email), parseResult.GetRequiredValue(name), parseResult.GetValue(password), !parseResult.GetValue(noMigrate), token)));
        return command;
    }
}

public sealed class DatabaseSeedHandler(LedgerDbContext db, IPasswordService passwords, IPasswordInput passwordInput, ILocalDate clock, ICliOutput output)
{
    public async Task ExecuteAsync(string email, string name, string? suppliedPassword, bool migrate, CancellationToken ct)
    {
        if (migrate) await db.Database.MigrateAsync(ct);
        var normalized = ApplicationRules.NormalizeEmail(email);
        var existing = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.NormalizedEmail == normalized, ct);
        if (existing is not null)
        {
            output.Write($"Seed member {existing.Email} already exists; no data was changed.", new { success = true, created = false, userId = existing.Id, existing.Email });
            return;
        }

        if (string.IsNullOrWhiteSpace(name)) throw new CliException("Name is required.", "validation_failed", 2);
        var rawPassword = passwordInput.Read(suppliedPassword);
        try { ApplicationRules.ValidatePassword(rawPassword); }
        catch (AppProblem ex) { throw new CliException(ex.Errors.SelectMany(x => x.Value).FirstOrDefault() ?? ex.Message, ex.Code, 2); }

        var now = clock.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var user = new User
        {
            Name = name.Trim(), Email = email.Trim(), NormalizedEmail = normalized,
            PasswordHash = passwords.Hash(rawPassword), EmailVerified = true, HeightCm = 172m, MemberSince = now.AddDays(-45)
        };
        db.Users.Add(user);
        db.Preferences.Add(new Preferences { UserId = user.Id, TimeZone = "UTC", ReminderEnabled = false });
        db.Goals.Add(new Goal { UserId = user.Id, StartWeightKg = 86m, GoalWeightKg = 78m, TargetDate = today.AddDays(75), CreatedAt = now.AddDays(-35), UpdatedAt = now });

        var weighIns = Enumerable.Range(0, 36)
            .Select(offset => new WeighIn
            {
                UserId = user.Id,
                Date = today.AddDays(offset - 35),
                WeightKg = Math.Round(86m - (offset * 0.13m) + ((offset % 5) - 2) * 0.08m, 1),
                Note = offset == 0 ? "Started tracking" : null,
                CreatedAt = now.AddDays(offset - 35), UpdatedAt = now.AddDays(offset - 35)
            }).ToArray();
        db.WeighIns.AddRange(weighIns);
        var streak = StreakCalculator.Calculate(weighIns.Select(x => x.Date), today);
        db.Streaks.Add(new Streak { UserId = user.Id, Current = streak.Current, Longest = streak.Longest, LastLoggedDate = today });
        db.Milestones.AddRange(
            new Milestone { UserId = user.Id, Type = BadgeType.FirstEntry, EarnedAt = now.AddDays(-35) },
            new Milestone { UserId = user.Id, Type = BadgeType.SevenDayStreak, EarnedAt = now.AddDays(-29) },
            new Milestone { UserId = user.Id, Type = BadgeType.OneKg, EarnedAt = now.AddDays(-27) },
            new Milestone { UserId = user.Id, Type = BadgeType.TwoPointFiveKg, EarnedAt = now.AddDays(-15) });
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "cli.database_seeded", Source = "ledger-cli", Timestamp = now });
        await db.SaveChangesAsync(ct);
        output.Write($"Created demo member {user.Email} with {weighIns.Length} weigh-ins.", new { success = true, created = true, userId = user.Id, user.Email, weighIns = weighIns.Length });
    }
}
