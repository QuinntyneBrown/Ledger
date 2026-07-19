using Ledger.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.CommandLine;
using System.CommandLine.Parsing;
using System.Text.Json;

namespace Ledger.Cli;

public static class CliHost
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public static async Task<int> RunAsync<THandler>(ParseResult parseResult, CancellationToken cancellationToken, Func<THandler, CancellationToken, Task> action)
        where THandler : notnull
    {
        var json = parseResult.GetValue(CliOptions.Json);
        try
        {
            using var host = Build(parseResult);
            using var scope = host.Services.CreateScope();
            await action(scope.ServiceProvider.GetRequiredService<THandler>(), cancellationToken);
            return 0;
        }
        catch (CliException ex)
        {
            WriteError(json, ex.Message, ex.ErrorCode);
            return ex.ExitCode;
        }
        catch (Exception ex)
        {
            var verbose = parseResult.GetValue(CliOptions.Verbose);
            WriteError(json, verbose ? ex.ToString() : ex.Message, "unhandled_error");
            return 1;
        }
    }

    private static IHost Build(ParseResult parseResult)
    {
        var environment = parseResult.GetValue(CliOptions.Environment)
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environments.Production;
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ApplicationName = typeof(Program).Assembly.FullName,
            ContentRootPath = AppContext.BaseDirectory,
            EnvironmentName = environment
        });

        ApplyConnectionOverride(builder.Configuration, parseResult.GetValue(CliOptions.ConnectionString));
        builder.Logging.ClearProviders();
        if (parseResult.GetValue(CliOptions.Verbose))
            builder.Logging.AddSimpleConsole(options => options.SingleLine = true).SetMinimumLevel(LogLevel.Debug);

        builder.Services.AddLedgerPersistence(builder.Configuration);
        builder.Services.AddLedgerCli(builder.Configuration, parseResult.GetValue(CliOptions.Json));
        return builder.Build();
    }

    private static void ApplyConnectionOverride(ConfigurationManager configuration, string? commandLineValue)
    {
        var azureValue = Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTIONSTRING")
            ?? Environment.GetEnvironmentVariable("SQLAZURECONNSTR_Ledger")
            ?? Environment.GetEnvironmentVariable("SQLCONNSTR_Ledger")
            ?? Environment.GetEnvironmentVariable("LEDGER_SQL_CONNECTION_STRING");
        var value = string.IsNullOrWhiteSpace(commandLineValue) ? azureValue : commandLineValue;
        if (!string.IsNullOrWhiteSpace(value)) configuration["ConnectionStrings:Ledger"] = value;
    }

    private static void WriteError(bool json, string message, string code)
    {
        Console.Error.WriteLine(json
            ? JsonSerializer.Serialize(new { success = false, error = new { code, message } }, JsonOptions)
            : $"Error: {message}");
    }
}
