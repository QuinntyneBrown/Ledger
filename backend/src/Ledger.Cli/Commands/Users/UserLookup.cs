using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Cli.Commands.Users;

internal static class UserLookup
{
    public static async Task<User> ActiveByEmailAsync(LedgerDbContext db, string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new CliException("Email is required.", "validation_failed", 2);
        var normalized = ApplicationRules.NormalizeEmail(email);
        return await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalized && !x.IsDeleted, ct)
            ?? throw new CliException($"No active member exists with email {email}.", "user_not_found", 3);
    }
}
