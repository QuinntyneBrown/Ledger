using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UsersCommand
{
    public static Command Create()
    {
        var command = new Command("users", "Administer Ledger member accounts and sessions.");
        command.Subcommands.Add(UserAddCommand.Create());
        command.Subcommands.Add(UserListCommand.Create());
        command.Subcommands.Add(UserResetPasswordCommand.Create());
        command.Subcommands.Add(UserSetPasswordCommand.Create());
        command.Subcommands.Add(UserVerifyEmailCommand.Create());
        command.Subcommands.Add(UserUnlockCommand.Create());
        command.Subcommands.Add(UserRevokeSessionsCommand.Create());
        command.Subcommands.Add(UserDeleteCommand.Create());
        return command;
    }
}
