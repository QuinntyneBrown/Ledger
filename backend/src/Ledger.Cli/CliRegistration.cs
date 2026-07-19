using Ledger.Cli.Commands.Data;
using Ledger.Cli.Commands.Database;
using Ledger.Cli.Commands.Maintenance;
using Ledger.Cli.Commands.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ledger.Cli;

public static class CliRegistration
{
    public static IServiceCollection AddLedgerCli(this IServiceCollection services, IConfiguration configuration, bool json)
    {
        services.AddSingleton<ICliOutput>(new CliOutput(json));
        services.AddSingleton<IPasswordInput, PasswordInput>();
        services.Configure<MaintenanceOptions>(configuration.GetSection("Cli"));
        services.AddScoped<DatabaseStatusHandler>();
        services.AddScoped<DatabaseMigrateHandler>();
        services.AddScoped<DatabaseSeedHandler>();
        services.AddScoped<UserAddHandler>();
        services.AddScoped<UserListHandler>();
        services.AddScoped<UserResetPasswordHandler>();
        services.AddScoped<UserVerifyEmailHandler>();
        services.AddScoped<UserUnlockHandler>();
        services.AddScoped<UserRevokeSessionsHandler>();
        services.AddScoped<UserDeleteHandler>();
        services.AddScoped<DataExportHandler>();
        services.AddScoped<DataEraseHandler>();
        services.AddScoped<MaintenancePruneHandler>();
        return services;
    }
}
