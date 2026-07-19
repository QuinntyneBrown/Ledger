# Ledger CLI operations guide

`Ledger.Cli` is the administrative surface for Ledger. It uses `System.CommandLine`, the Microsoft generic host, dependency injection, configuration, logging, the production EF Core model, and the production password hasher. Each leaf command and handler lives in its own file.

## Command catalog

```text
database status       Check connectivity, migration state, and core record counts
database migrate      Apply pending EF Core migrations
database seed         Idempotently create a representative demo member and data

users add              Create an account and default preferences
users list             List active or deleted accounts
users reset-password   Set a password, unlock the account, and revoke sessions
users verify-email     Administratively verify an email
users unlock           Clear a sign-in lockout
users revoke-sessions  Sign the member out everywhere
users delete           Erase member data and anonymize the account

data export            Export member data without password or token material
data erase             Erase application data while preserving the account
maintenance prune      Remove expired sync, token, and session records
```

Every command accepts:

```text
--connection-string    One-off SQL Server connection override
--environment, -e      Load the selected appsettings environment
--json                 Stable machine-readable output
--verbose, -v          Detailed diagnostics
```

Destructive commands require `--confirm` with the exact member email. Passwords are read from a hidden interactive prompt by default. For automation, set `LEDGER_CLI_PASSWORD`; using `--password` is supported but can expose the value in shell history and process listings.

## Configuration precedence

The CLI loads `appsettings.json`, optional `appsettings.{Environment}.json`, environment variables, Azure SQL connection variables, and finally `--connection-string`. The normal cross-platform setting is:

```text
ConnectionStrings__Ledger=Server=...;Database=Ledger;...
```

It also recognizes `SQLAZURECONNSTR_Ledger` and `SQLCONNSTR_Ledger` emitted by Azure App Service connection settings, plus `AZURE_SQL_CONNECTIONSTRING` and `LEDGER_SQL_CONNECTION_STRING`. Store production connection strings and passwords in Azure configuration or Key Vault references rather than scripts.

## Local use

From the repository root:

```powershell
dotnet run --project backend/src/Ledger.Cli -- database migrate
dotnet run --project backend/src/Ledger.Cli -- database status --json

$env:LEDGER_CLI_PASSWORD = 'Demo-password1!'
dotnet run --project backend/src/Ledger.Cli -- database seed --email demo@ledger.local
dotnet run --project backend/src/Ledger.Cli -- users list
dotnet run --project backend/src/Ledger.Cli -- maintenance prune --dry-run
Remove-Item Env:LEDGER_CLI_PASSWORD
```

The default connection uses SQL Server LocalDB. Use `ConnectionStrings__Ledger` when targeting the SQL container or another SQL Server.

## Publish and containers

Publish a standalone framework-dependent CLI artifact with:

```powershell
dotnet publish backend/src/Ledger.Cli/Ledger.Cli.csproj -c Release -o artifacts/ledger-cli
dotnet artifacts/ledger-cli/ledger.dll --help
```

The backend container image includes the published CLI at `/app/cli/ledger.dll`. Run an administrative command against the Compose database without starting another API process:

```powershell
docker compose run --rm --entrypoint dotnet api /app/cli/ledger.dll database migrate
docker compose run --rm --entrypoint dotnet api /app/cli/ledger.dll database status --json
```

## Azure operation

Use the same published backend image for Azure App Service, Container Apps, and one-off Container Apps Jobs. The API remains the image entry point; a release job overrides the command with:

```text
dotnet /app/cli/ledger.dll database migrate --json
```

Run migration as a single-instance release step before shifting traffic to a new API revision. Other useful job commands are `maintenance prune --json` on a schedule and `database status --json` for deployment verification. Account commands can run from an App Service SSH/Kudu console or a short-lived job whose managed configuration supplies the SQL connection and, where needed, `LEDGER_CLI_PASSWORD`.

Examples:

```text
dotnet /app/cli/ledger.dll users reset-password --email member@example.com --json
dotnet /app/cli/ledger.dll users revoke-sessions --email member@example.com --json
dotnet /app/cli/ledger.dll data export --email member@example.com --output /tmp/member-export.json --json
```

Treat exported data as sensitive, copy it only to an approved encrypted destination, and delete the short-lived job/container afterward.
