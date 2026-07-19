using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Database;

public static class DatabaseStatusCommand
{
    public static Command Create()
    {
        var command = new Command("status", "Check connectivity, migrations, and record counts.");
        command.SetAction((parseResult, ct) => CliHost.RunAsync<DatabaseStatusHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(token)));
        return command;
    }
}

public sealed class DatabaseStatusHandler(LedgerDbContext db, ICliOutput output)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var canConnect = await db.Database.CanConnectAsync(ct);
        if (!canConnect) throw new CliException("Could not connect to the configured Ledger database.", "database_unavailable");
        var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToArray();
        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToArray();
        var status = new
        {
            success = true,
            connected = true,
            database = db.Database.GetDbConnection().Database,
            migrations = new { applied, pending },
            records = new
            {
                users = await db.Users.CountAsync(ct),
                activeUsers = await db.Users.CountAsync(x => !x.IsDeleted, ct),
                weighIns = await db.WeighIns.CountAsync(ct),
                goals = await db.Goals.CountAsync(ct),
                activeSessions = await db.RefreshSessions.CountAsync(x => x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, ct)
            }
        };
        output.Write($"Connected to {status.database}. Applied migrations: {applied.Length}; pending: {pending.Length}; active users: {status.records.activeUsers}.", status);
    }
}
