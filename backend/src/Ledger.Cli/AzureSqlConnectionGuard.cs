using Microsoft.Data.SqlClient;

namespace Ledger.Cli;

internal static class AzureSqlConnectionGuard
{
    public static void EnsureTargetsAzureSql(string? connectionString)
    {
        if (IsAzureSql(connectionString)) return;

        throw new CliException(
            "This command only runs against Azure SQL. Set ConnectionStrings__Ledger, " +
            "LEDGER_SQL_CONNECTION_STRING, or --connection-string to the deployed Azure SQL database.",
            "azure_sql_connection_required",
            2);
    }

    internal static bool IsAzureSql(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return false;

        try
        {
            var dataSource = new SqlConnectionStringBuilder(connectionString).DataSource.Trim();
            if (dataSource.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
                dataSource = dataSource[4..];

            var host = dataSource.Split(',', 2)[0].Trim();
            return host.EndsWith(".database.windows.net", StringComparison.OrdinalIgnoreCase);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
