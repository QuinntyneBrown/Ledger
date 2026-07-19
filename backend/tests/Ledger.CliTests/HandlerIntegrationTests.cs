using Ledger.Application;
using Ledger.Cli;
using Ledger.Cli.Commands.Data;
using Ledger.Cli.Commands.Database;
using Ledger.Cli.Commands.Maintenance;
using Ledger.Cli.Commands.Users;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Xunit;

namespace Ledger.CliTests;

public sealed class HandlerIntegrationTests
{
    [Fact]
    public async Task Administration_lifecycle_uses_real_relational_operations()
    {
        var options = new DbContextOptionsBuilder<LedgerDbContext>().UseSqlite("Data Source=:memory:").Options;
        await using var db = new LedgerDbContext(options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var clock = new FixedClock(new DateTimeOffset(2026, 7, 18, 12, 0, 0, TimeSpan.Zero));
        var passwords = new PasswordService();
        var output = new CapturingOutput();
        var passwordInput = new PasswordInput();

        var add = new UserAddHandler(db, passwords, passwordInput, clock, output);
        await add.ExecuteAsync("operator@example.test", "Operator", "Initial-password1!", true, CancellationToken.None);
        var operatorUser = await db.Users.SingleAsync(x => x.NormalizedEmail == "OPERATOR@EXAMPLE.TEST");
        Assert.True(passwords.Verify("Initial-password1!", operatorUser.PasswordHash));
        Assert.True(await db.Preferences.AnyAsync(x => x.UserId == operatorUser.Id));

        var activeSession = new RefreshSession { UserId = operatorUser.Id, TokenHash = "session", ExpiresAt = clock.UtcNow.AddDays(1) };
        db.RefreshSessions.Add(activeSession);
        db.OneTimeTokens.Add(new OneTimeToken { UserId = operatorUser.Id, Purpose = "password-reset", TokenHash = "token", ExpiresAt = clock.UtcNow.AddHours(1) });
        await db.SaveChangesAsync();
        var reset = new UserResetPasswordHandler(db, passwords, passwordInput, clock, output);
        await reset.ExecuteAsync(operatorUser.Email, "Replacement-password2!", CancellationToken.None);
        Assert.True(passwords.Verify("Replacement-password2!", operatorUser.PasswordHash));
        Assert.Equal(clock.UtcNow, activeSession.RevokedAt);

        var seed = new DatabaseSeedHandler(db, passwords, passwordInput, clock, output);
        await seed.ExecuteAsync("demo@example.test", "Demo", "Demo-password3!", false, CancellationToken.None);
        var demo = await db.Users.SingleAsync(x => x.NormalizedEmail == "DEMO@EXAMPLE.TEST");
        Assert.Equal(36, await db.WeighIns.CountAsync(x => x.UserId == demo.Id));
        Assert.Equal(4, await db.Milestones.CountAsync(x => x.UserId == demo.Id));

        var exportPath = Path.Combine(Path.GetTempPath(), $"ledger-cli-test-{Guid.NewGuid():N}.json");
        try
        {
            var export = new DataExportHandler(db, output);
            await export.ExecuteAsync(demo.Email, new FileInfo(exportPath), CancellationToken.None);
            var json = await File.ReadAllTextAsync(exportPath);
            Assert.Contains("\"weighIns\"", json, StringComparison.Ordinal);
            Assert.DoesNotContain("passwordHash", json, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("tokenHash", json, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            if (File.Exists(exportPath)) File.Delete(exportPath);
        }

        var erase = new DataEraseHandler(db, clock, output);
        await erase.ExecuteAsync(demo.Email, demo.Email, CancellationToken.None);
        Assert.False(await db.WeighIns.AnyAsync(x => x.UserId == demo.Id));
        Assert.True(await db.Users.AnyAsync(x => x.Id == demo.Id && !x.IsDeleted));

        db.SyncChanges.Add(new SyncChange { UserId = operatorUser.Id, EntityId = Guid.NewGuid(), EntityType = SyncEntityType.Profile, Kind = ChangeKind.Updated, ServerTimestamp = clock.UtcNow.AddDays(-40) });
        db.OneTimeTokens.Add(new OneTimeToken { UserId = operatorUser.Id, Purpose = "expired", TokenHash = "expired-token", ExpiresAt = clock.UtcNow.AddDays(-20) });
        db.RefreshSessions.Add(new RefreshSession { UserId = operatorUser.Id, TokenHash = "expired-session", ExpiresAt = clock.UtcNow.AddDays(-20) });
        await db.SaveChangesAsync();
        var prune = new MaintenancePruneHandler(db, clock, Options.Create(new MaintenanceOptions()), output);
        await prune.ExecuteAsync(true, null, null, CancellationToken.None);
        Assert.True(await db.SyncChanges.AnyAsync());
        Assert.True(await db.OneTimeTokens.AnyAsync(x => x.TokenHash == "expired-token"));
        Assert.True(await db.RefreshSessions.AnyAsync(x => x.TokenHash == "expired-session"));

        var delete = new UserDeleteHandler(db, clock, output);
        await delete.ExecuteAsync(operatorUser.Email, operatorUser.Email, CancellationToken.None);
        Assert.True(operatorUser.IsDeleted);
        Assert.StartsWith("deleted-", operatorUser.Email, StringComparison.Ordinal);
        Assert.False(await db.Preferences.AnyAsync(x => x.UserId == operatorUser.Id));
    }

    private sealed class CapturingOutput : ICliOutput
    {
        public List<string> Messages { get; } = [];
        public void Write(string message, object? value = null) => Messages.Add(message);
    }

    private sealed class FixedClock(DateTimeOffset now) : ILocalDate
    {
        public DateTimeOffset UtcNow => now;
        public DateOnly Today(string timeZone) => DateOnly.FromDateTime(now.UtcDateTime);
    }
}
