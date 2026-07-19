using Ledger.Application;
using Ledger.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Infrastructure;

public sealed class LedgerDbContext(DbContextOptions<LedgerDbContext> options) : DbContext(options), ILedgerDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Preferences> Preferences => Set<Preferences>();
    public DbSet<OnboardingDraft> OnboardingDrafts => Set<OnboardingDraft>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<WeighIn> WeighIns => Set<WeighIn>();
    public DbSet<Streak> Streaks => Set<Streak>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
    public DbSet<OneTimeToken> OneTimeTokens => Set<OneTimeToken>();
    public DbSet<SyncChange> SyncChanges => Set<SyncChange>();
    public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.NormalizedEmail).IsUnique();
        b.Entity<Preferences>().HasKey(x => x.UserId);
        b.Entity<OnboardingDraft>().HasKey(x => x.UserId);
        b.Entity<Streak>().HasKey(x => x.UserId);
        b.Entity<WeighIn>().HasIndex(x => new { x.UserId, x.Date }).IsUnique();
        b.Entity<WeighIn>().Property(x => x.WeightKg).HasPrecision(7, 3);
        b.Entity<OnboardingDraft>().Property(x => x.CurrentWeightKg).HasPrecision(7, 3);
        b.Entity<OnboardingDraft>().Property(x => x.GoalWeightKg).HasPrecision(7, 3);
        b.Entity<User>().Property(x => x.HeightCm).HasPrecision(5, 1);
        b.Entity<Goal>().HasIndex(x => x.UserId).IsUnique();
        b.Entity<Goal>().Property(x => x.StartWeightKg).HasPrecision(7, 3);
        b.Entity<Goal>().Property(x => x.GoalWeightKg).HasPrecision(7, 3);
        b.Entity<Milestone>().HasIndex(x => new { x.UserId, x.Type }).IsUnique();
        b.Entity<RefreshSession>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<OneTimeToken>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<SyncChange>().HasIndex(x => new { x.UserId, x.ServerTimestamp });
        b.Entity<PushSubscription>().HasIndex(x => new { x.UserId, x.Endpoint }).IsUnique();
    }
}
