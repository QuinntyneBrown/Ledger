using System.CommandLine;

namespace Ledger.Cli;

public static class CliOptions
{
    public static readonly Option<string?> ConnectionString = new("--connection-string")
    {
        Description = "SQL Server connection string. Prefer ConnectionStrings__Ledger or an Azure connection setting.",
        Recursive = true
    };

    public static readonly Option<string?> Environment = new("--environment", "-e")
    {
        Description = "Host environment used to load appsettings.{Environment}.json.",
        Recursive = true
    };

    public static readonly Option<bool> Json = new("--json")
    {
        Description = "Write machine-readable JSON output.",
        Recursive = true
    };

    public static readonly Option<bool> Verbose = new("--verbose", "-v")
    {
        Description = "Enable detailed diagnostic logging.",
        Recursive = true
    };
}
