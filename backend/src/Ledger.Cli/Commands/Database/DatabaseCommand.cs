using System.CommandLine;

namespace Ledger.Cli.Commands.Database;

public static class DatabaseCommand
{
    public static Command Create()
    {
        var command = new Command("database", "Inspect, migrate, and seed the Ledger database.");
        command.Subcommands.Add(DatabaseStatusCommand.Create());
        command.Subcommands.Add(DatabaseMigrateCommand.Create());
        command.Subcommands.Add(DatabaseSeedCommand.Create());
        return command;
    }
}
