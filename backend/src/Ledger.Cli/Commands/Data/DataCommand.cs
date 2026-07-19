using System.CommandLine;

namespace Ledger.Cli.Commands.Data;

public static class DataCommand
{
    public static Command Create()
    {
        var command = new Command("data", "Export or erase application data for a member.");
        command.Subcommands.Add(DataExportCommand.Create());
        command.Subcommands.Add(DataEraseCommand.Create());
        return command;
    }
}
