using Ledger.Cli.Commands.Data;
using Ledger.Cli.Commands.Database;
using Ledger.Cli.Commands.Maintenance;
using Ledger.Cli.Commands.Users;
using System.CommandLine;

namespace Ledger.Cli;

public static class RootCommandFactory
{
    public static RootCommand Create()
    {
        var root = new RootCommand("Ledger application administration for local, CI/CD, and Azure environments.");
        root.Options.Add(CliOptions.ConnectionString);
        root.Options.Add(CliOptions.Environment);
        root.Options.Add(CliOptions.Json);
        root.Options.Add(CliOptions.Verbose);
        root.Subcommands.Add(DatabaseCommand.Create());
        root.Subcommands.Add(UsersCommand.Create());
        root.Subcommands.Add(DataCommand.Create());
        root.Subcommands.Add(MaintenanceCommand.Create());
        return root;
    }
}
