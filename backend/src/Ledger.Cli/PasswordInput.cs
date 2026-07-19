namespace Ledger.Cli;

public interface IPasswordInput
{
    string Read(string? suppliedPassword);
}

public sealed class PasswordInput : IPasswordInput
{
    public string Read(string? suppliedPassword)
    {
        var password = suppliedPassword ?? Environment.GetEnvironmentVariable("LEDGER_CLI_PASSWORD");
        if (!string.IsNullOrEmpty(password)) return password;
        if (Console.IsInputRedirected)
            throw new CliException("No password was supplied. Set LEDGER_CLI_PASSWORD or use --password.", "password_required", 2);

        Console.Error.Write("Password: ");
        var chars = new List<char>();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (chars.Count > 0) chars.RemoveAt(chars.Count - 1);
                continue;
            }
            if (!char.IsControl(key.KeyChar)) chars.Add(key.KeyChar);
        }
        Console.Error.WriteLine();
        return new string(chars.ToArray());
    }
}
