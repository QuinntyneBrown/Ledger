using System.Text.Json;

namespace Ledger.Cli;

public interface ICliOutput
{
    void Write(string message, object? value = null);
}

public sealed class CliOutput(bool json) : ICliOutput
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public void Write(string message, object? value = null)
    {
        if (json)
        {
            Console.WriteLine(JsonSerializer.Serialize(value ?? new { success = true, message }, Options));
            return;
        }

        Console.WriteLine(message);
    }
}
