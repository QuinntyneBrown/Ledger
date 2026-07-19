using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Database;

public static class DatabaseMigrateCommand
{
    public static Command Create()
    {
        var command = new Command("migrate", "Apply all pending Entity Framework Core migrations.");
        command.SetAction((parseResult, ct) => CliHost.RunAsync<DatabaseMigrateHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(token)));
        return command;
    }
}

public sealed class DatabaseMigrateHandler(LedgerDbContext db, ICliOutput output)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToArray();
        await db.Database.MigrateAsync(ct);
        output.Write(pending.Length == 0 ? "Database is already up to date." : $"Applied {pending.Length} migration(s).",
            new { success = true, appliedCount = pending.Length, migrations = pending });
    }
}
