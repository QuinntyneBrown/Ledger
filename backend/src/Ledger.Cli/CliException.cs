namespace Ledger.Cli;

public sealed class CliException(string message, string errorCode = "operation_failed", int exitCode = 1) : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
    public int ExitCode { get; } = exitCode;
}
