using System.CommandLine;

namespace Ledger.Cli.Commands.Maintenance;

public static class MaintenanceCommand
{
    public static Command Create()
    {
        var command = new Command("maintenance", "Run periodic operational cleanup tasks.");
        command.Subcommands.Add(MaintenancePruneCommand.Create());
        return command;
    }
}
