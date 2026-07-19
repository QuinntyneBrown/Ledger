using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ledger.Cli.Commands.Data;

public static class DataExportCommand
{
    public static Command Create()
    {
        var email = new Option<string>("--email") { Description = "Member email address.", Required = true };
        var output = new Option<FileInfo?>("--output", "-o") { Description = "Destination JSON file. Defaults to ledger-export-{user-id}.json." };
        var command = new Command("export", "Export a member's account and application data as JSON without credentials or session tokens.");
        command.Options.Add(email); command.Options.Add(output);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<DataExportHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetRequiredValue(email), parseResult.GetValue(output), token)));
        return command;
    }
}

public sealed class DataExportHandler(LedgerDbContext db, ICliOutput output)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task ExecuteAsync(string email, FileInfo? destination, CancellationToken ct)
    {
        var user = await Commands.Users.UserLookup.ActiveByEmailAsync(db, email, ct);
        var id = user.Id;
        var goals = await db.Goals.AsNoTracking().Where(x => x.UserId == id).ToListAsync(ct);
        var milestones = await db.Milestones.AsNoTracking().Where(x => x.UserId == id).ToListAsync(ct);
        var export = new
        {
            exportedAt = DateTimeOffset.UtcNow,
            account = new { user.Id, user.Name, user.Email, user.EmailVerified, user.HeightCm, user.AvatarUrl, user.MemberSince, user.PasswordUpdatedAt },
            preferences = await db.Preferences.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == id, ct),
            onboarding = await db.OnboardingDrafts.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == id, ct),
            goals = goals.OrderBy(x => x.CreatedAt),
            weighIns = await db.WeighIns.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.Date).ToListAsync(ct),
            streak = await db.Streaks.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == id, ct),
            milestones = milestones.OrderBy(x => x.EarnedAt)
        };
        destination ??= new FileInfo(Path.Combine(Environment.CurrentDirectory, $"ledger-export-{id:N}.json"));
        if (destination.Directory is not null) destination.Directory.Create();
        await using var stream = new FileStream(destination.FullName, FileMode.Create, FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous);
        await JsonSerializer.SerializeAsync(stream, export, JsonOptions, ct);
        output.Write($"Exported data for {user.Email} to {destination.FullName}.", new { success = true, userId = id, path = destination.FullName });
    }
}
