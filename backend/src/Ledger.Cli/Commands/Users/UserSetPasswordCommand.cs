using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserSetPasswordCommand
{
    public static Command Create()
    {
        var username = new Option<string>("--username")
        {
            Description = "Ledger sign-in username (the member email address).",
            Required = true
        };
        var password = new Option<string?>("--password")
        {
            Description = "New password. Prefer LEDGER_CLI_PASSWORD to keep it out of shell history."
        };
        var command = new Command(
            "set-password",
            "Set a member password in the deployed Azure SQL database, unlock the member, and revoke all sessions.");
        command.Options.Add(username);
        command.Options.Add(password);
        command.SetAction((parseResult, ct) =>
            CliHost.RunAzureSqlAsync<UserResetPasswordHandler>(
                parseResult,
                ct,
                (handler, token) => handler.ExecuteAsync(
                    parseResult.GetRequiredValue(username),
                    parseResult.GetValue(password),
                    token)));
        return command;
    }
}
