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
    [InlineData("users", "add,delete,list,reset-password,revoke-sessions,unlock,verify-email")]
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
}
