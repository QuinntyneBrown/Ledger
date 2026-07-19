using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.CommandLine;

namespace Ledger.Cli.Commands.Users;

public static class UserListCommand
{
    public static Command Create()
    {
        var includeDeleted = new Option<bool>("--include-deleted") { Description = "Include anonymized deleted accounts." };
        var limit = new Option<int>("--limit") { Description = "Maximum number of members to return (1-1000).", DefaultValueFactory = _ => 100 };
        var command = new Command("list", "List member accounts.");
        command.Options.Add(includeDeleted); command.Options.Add(limit);
        command.SetAction((parseResult, ct) => CliHost.RunAsync<UserListHandler>(parseResult, ct, (handler, token) => handler.ExecuteAsync(parseResult.GetValue(includeDeleted), parseResult.GetValue(limit), token)));
        return command;
    }
}

public sealed class UserListHandler(LedgerDbContext db, ICliOutput output)
{
    public async Task ExecuteAsync(bool includeDeleted, int limit, CancellationToken ct)
    {
        if (limit is < 1 or > 1000) throw new CliException("Limit must be between 1 and 1000.", "validation_failed", 2);
        var query = db.Users.AsNoTracking();
        if (!includeDeleted) query = query.Where(x => !x.IsDeleted);
        var users = await query.OrderBy(x => x.Email).Take(limit).Select(x => new
        {
            x.Id, x.Email, x.Name, x.EmailVerified, x.IsDeleted, x.MemberSince, x.LockedUntil
        }).ToListAsync(ct);
        var lines = users.Select(x => $"{x.Email,-36} {x.Name,-24} verified={x.EmailVerified,-5} locked={x.LockedUntil is not null}");
        output.Write(users.Count == 0 ? "No members found." : string.Join(Environment.NewLine, lines), new { success = true, count = users.Count, users });
    }
}
