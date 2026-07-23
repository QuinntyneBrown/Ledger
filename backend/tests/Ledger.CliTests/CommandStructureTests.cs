using System.CommandLine;
using Ledger.Cli;
using Xunit;

namespace Ledger.CliTests;

public sealed class CommandStructureTests
{
    [Fact]
    public void Root_exposes_all_operational_areas()
    {
        var root = RootCommandFactory.Create();

        Assert.Equal(["data", "database", "maintenance", "users"], root.Subcommands.Select(x => x.Name).Order().ToArray());
    }

    [Theory]
    [InlineData("database", "migrate,seed,status")]
    [InlineData("users", "add,delete,list,reset-password,revoke-sessions,set-password,unlock,verify-email")]
    [InlineData("data", "erase,export")]
    [InlineData("maintenance", "prune")]
    public void Groups_expose_expected_leaf_commands(string groupName, string expectedCsv)
    {
        var root = RootCommandFactory.Create();
        var group = Assert.Single(root.Subcommands, x => x.Name == groupName);

        Assert.Equal(expectedCsv.Split(','), group.Subcommands.Select(x => x.Name).Order().ToArray());
    }

    [Fact]
    public void Required_user_options_are_validated_before_invocation()
    {
        var result = RootCommandFactory.Create().Parse(["users", "add", "--name", "Ada"]);

        Assert.NotEmpty(result.Errors);
        Assert.Contains(result.Errors, x => x.Message.Contains("--email", StringComparison.Ordinal));
    }

    [Fact]
    public void Global_options_are_accepted_after_leaf_commands()
    {
        var result = RootCommandFactory.Create().Parse([
            "database", "status", "--json", "--environment", "Staging",
            "--connection-string", "Server=example;Database=Ledger"]);

        Assert.Empty(result.Errors);
        Assert.True(result.GetValue(CliOptions.Json));
        Assert.Equal("Staging", result.GetValue(CliOptions.Environment));
    }

    [Fact]
    public void Set_password_accepts_a_username_and_password()
    {
        var result = RootCommandFactory.Create().Parse([
            "users", "set-password",
            "--username", "member@example.com",
            "--password", "Replacement-password2!",
            "--connection-string", "Server=tcp:ledger.database.windows.net,1433;Database=Ledger;User ID=operator;Password=secret"]);

        Assert.Empty(result.Errors);
    }

    [Theory]
    [InlineData("Server=tcp:ledger.database.windows.net,1433;Database=Ledger", true)]
    [InlineData("Data Source=LEDGER.database.windows.net;Initial Catalog=Ledger", true)]
    [InlineData("Server=(localdb)\\mssqllocaldb;Database=Ledger", false)]
    [InlineData("Server=sql;Database=Ledger", false)]
    [InlineData("", false)]
    public void Azure_SQL_target_is_identified_from_the_connection_string(string connectionString, bool expected)
    {
        Assert.Equal(expected, AzureSqlConnectionGuard.IsAzureSql(connectionString));
    }
}
