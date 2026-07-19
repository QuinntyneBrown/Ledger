namespace Ledger.Cli.Commands.Maintenance;

public sealed class MaintenanceOptions
{
    public int SyncRetentionDays { get; set; } = 30;
    public int ExpiredSecurityDataRetentionDays { get; set; } = 7;
}
