using Ledger.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Application;

public sealed record RegisterCommand(string Name, string Email, string Password, bool TermsAccepted) : IRequest<Guid>;
public sealed class RegisterHandler(ILedgerDbContext db, IPasswordService passwords, ITokenService tokens, IEmailSender email, IAppLinks links, ILocalDate clock) : IRequestHandler<RegisterCommand, Guid>
{
    public async Task<Guid> Handle(RegisterCommand r, CancellationToken ct)
    {
        if (!r.TermsAccepted) throw AppProblem.Validation("termsAccepted", "You must accept the Terms and Privacy Policy.");
        ApplicationRules.ValidatePassword(r.Password);
        if (string.IsNullOrWhiteSpace(r.Name)) throw AppProblem.Validation("name", "Name is required.");
        var normalized = ApplicationRules.NormalizeEmail(r.Email);
        if (await db.Users.AnyAsync(x => x.NormalizedEmail == normalized && !x.IsDeleted, ct)) throw AppProblem.Validation("email", "That email is already in use.");
        var user = new User { Name = r.Name.Trim(), Email = r.Email.Trim(), NormalizedEmail = normalized, PasswordHash = passwords.Hash(r.Password) };
        db.Users.Add(user);
        db.Preferences.Add(new Preferences { UserId = user.Id });
        var raw = tokens.CreateOpaqueToken();
        db.OneTimeTokens.Add(new OneTimeToken { UserId = user.Id, Purpose = "verify-email", TokenHash = tokens.HashToken(raw), ExpiresAt = clock.UtcNow.AddHours(24) });
        await db.SaveChangesAsync(ct);
        await email.SendAsync(user.Email, "Verify your Ledger email", $"Verify your email: {links.VerifyEmail(raw)}", ct);
        return user.Id;
    }
}

public sealed record VerifyEmailCommand(string Token) : IRequest;
public sealed class VerifyEmailHandler(ILedgerDbContext db, ITokenService tokens, ILocalDate clock) : IRequestHandler<VerifyEmailCommand>
{
    public async Task Handle(VerifyEmailCommand r, CancellationToken ct)
    {
        var hash = tokens.HashToken(r.Token);
        var token = await db.OneTimeTokens.SingleOrDefaultAsync(x => x.TokenHash == hash && x.Purpose == "verify-email", ct);
        if (token is null || token.ConsumedAt is not null || token.ExpiresAt <= clock.UtcNow) throw new AppProblem(400, "invalid_token", "This verification link is invalid or expired.");
        var user = await db.Users.SingleAsync(x => x.Id == token.UserId, ct);
        user.EmailVerified = true; token.ConsumedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

public sealed record ResendVerificationCommand(string Email) : IRequest;
public sealed class ResendVerificationHandler(ILedgerDbContext db, ITokenService tokens, IEmailSender email, IAppLinks links, ILocalDate clock) : IRequestHandler<ResendVerificationCommand>
{
    public async Task Handle(ResendVerificationCommand r, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == ApplicationRules.NormalizeEmail(r.Email) && !x.IsDeleted, ct); if (user is null || user.EmailVerified) return;
        var existing = await db.OneTimeTokens.Where(x => x.UserId == user.Id && x.Purpose == "verify-email" && x.ConsumedAt == null).ToListAsync(ct); foreach (var item in existing) item.ConsumedAt = clock.UtcNow;
        var raw = tokens.CreateOpaqueToken(); db.OneTimeTokens.Add(new OneTimeToken { UserId = user.Id, Purpose = "verify-email", TokenHash = tokens.HashToken(raw), ExpiresAt = clock.UtcNow.AddHours(24) }); await db.SaveChangesAsync(ct);
        await email.SendAsync(user.Email, "Verify your Ledger email", $"Verify your email: {links.VerifyEmail(raw)}", ct);
    }
}

public sealed record SignInCommand(string Email, string Password) : IRequest<AuthResult>;
public sealed class SignInHandler(ILedgerDbContext db, IPasswordService passwords, ITokenService tokens, IUserContext request, ILocalDate clock) : IRequestHandler<SignInCommand, AuthResult>
{
    public async Task<AuthResult> Handle(SignInCommand r, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == ApplicationRules.NormalizeEmail(r.Email) && !x.IsDeleted, ct);
        var generic = new AppProblem(401, "invalid_credentials", "Email or password is incorrect.");
        if (user?.LockedUntil > clock.UtcNow) throw generic;
        if (user is null || !passwords.Verify(r.Password, user.PasswordHash))
        {
            if (user is not null) { user.FailedLoginCount++; if (user.FailedLoginCount >= 5) { user.LockedUntil = clock.UtcNow.AddMinutes(15); db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "auth.lockout", Source = request.SourceIp }); } }
            db.AuditRecords.Add(new AuditRecord { ActorId = user?.Id, Action = "auth.sign_in_failed", Source = request.SourceIp });
            await db.SaveChangesAsync(ct); throw generic;
        }
        if (!user.EmailVerified) throw new AppProblem(403, "email_unverified", "Verify your email before signing in.");
        user.FailedLoginCount = 0; user.LockedUntil = null;
        var accessExpiry = clock.UtcNow.AddMinutes(15); var refresh = tokens.CreateOpaqueToken();
        db.RefreshSessions.Add(new RefreshSession { UserId = user.Id, TokenHash = tokens.HashToken(refresh), ExpiresAt = clock.UtcNow.AddDays(30), SourceIp = request.SourceIp, UserAgent = request.UserAgent });
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "auth.sign_in", Source = request.SourceIp });
        var onboarded = await db.Goals.AnyAsync(x => x.UserId == user.Id, ct);
        await db.SaveChangesAsync(ct);
        return new(tokens.CreateAccessToken(user, accessExpiry), accessExpiry, refresh, user.Id, user.Name, onboarded);
    }
}

public sealed record RefreshCommand(string Token) : IRequest<AuthResult>;
public sealed class RefreshHandler(ILedgerDbContext db, ITokenService tokens, IUserContext request, ILocalDate clock) : IRequestHandler<RefreshCommand, AuthResult>
{
    public async Task<AuthResult> Handle(RefreshCommand r, CancellationToken ct)
    {
        var session = await db.RefreshSessions.SingleOrDefaultAsync(x => x.TokenHash == tokens.HashToken(r.Token), ct);
        if (session is null || session.ExpiresAt <= clock.UtcNow) throw new AppProblem(401, "invalid_session", "The session is no longer valid.");
        if (session.RevokedAt is not null) { var active = await db.RefreshSessions.Where(x => x.UserId == session.UserId && x.RevokedAt == null).ToListAsync(ct); foreach (var item in active) item.RevokedAt = clock.UtcNow; db.AuditRecords.Add(new AuditRecord { ActorId = session.UserId, Action = "auth.refresh_reuse_detected", Source = request.SourceIp }); await db.SaveChangesAsync(ct); throw new AppProblem(401, "invalid_session", "The session is no longer valid."); }
        var user = await db.Users.SingleAsync(x => x.Id == session.UserId && !x.IsDeleted, ct);
        session.RevokedAt = clock.UtcNow; var raw = tokens.CreateOpaqueToken();
        var replacement = new RefreshSession { UserId = user.Id, TokenHash = tokens.HashToken(raw), ExpiresAt = clock.UtcNow.AddDays(30), SourceIp = request.SourceIp, UserAgent = request.UserAgent };
        db.RefreshSessions.Add(replacement); session.ReplacedById = replacement.Id;
        var onboarded = await db.Goals.AnyAsync(x => x.UserId == user.Id, ct); var expiry = clock.UtcNow.AddMinutes(15);
        await db.SaveChangesAsync(ct);
        return new(tokens.CreateAccessToken(user, expiry), expiry, raw, user.Id, user.Name, onboarded);
    }
}

public sealed record RequestPasswordResetCommand(string Email) : IRequest;
public sealed class RequestPasswordResetHandler(ILedgerDbContext db, ITokenService tokens, IEmailSender email, IAppLinks links, ILocalDate clock) : IRequestHandler<RequestPasswordResetCommand>
{
    public async Task Handle(RequestPasswordResetCommand r, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == ApplicationRules.NormalizeEmail(r.Email) && !x.IsDeleted, ct);
        if (user is null) return;
        var old = await db.OneTimeTokens.Where(x => x.UserId == user.Id && x.Purpose == "password-reset" && x.ConsumedAt == null).ToListAsync(ct);
        foreach (var item in old) item.ConsumedAt = clock.UtcNow;
        var raw = tokens.CreateOpaqueToken(); db.OneTimeTokens.Add(new OneTimeToken { UserId = user.Id, Purpose = "password-reset", TokenHash = tokens.HashToken(raw), ExpiresAt = clock.UtcNow.AddHours(1) });
        await db.SaveChangesAsync(ct); await email.SendAsync(user.Email, "Reset your Ledger password", $"Reset your password: {links.ResetPassword(raw)}", ct);
    }
}

public sealed record ResetPasswordCommand(string Token, string NewPassword) : IRequest;
public sealed class ResetPasswordHandler(ILedgerDbContext db, ITokenService tokens, IPasswordService passwords, IEmailSender email, ILocalDate clock) : IRequestHandler<ResetPasswordCommand>
{
    public async Task Handle(ResetPasswordCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidatePassword(r.NewPassword); var hash = tokens.HashToken(r.Token);
        var token = await db.OneTimeTokens.SingleOrDefaultAsync(x => x.TokenHash == hash && x.Purpose == "password-reset", ct);
        if (token is null || token.ConsumedAt is not null || token.ExpiresAt <= clock.UtcNow) throw new AppProblem(400, "invalid_token", "This reset link is invalid or expired.");
        var user = await db.Users.SingleAsync(x => x.Id == token.UserId, ct); user.PasswordHash = passwords.Hash(r.NewPassword); user.PasswordUpdatedAt = clock.UtcNow; token.ConsumedAt = clock.UtcNow;
        var sessions = await db.RefreshSessions.Where(x => x.UserId == user.Id && x.RevokedAt == null).ToListAsync(ct); foreach (var s in sessions) s.RevokedAt = clock.UtcNow;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "auth.password_reset" }); await db.SaveChangesAsync(ct);
        await email.SendAsync(user.Email, "Your Ledger password was reset", "Your password was changed. If this was not you, contact support.", ct);
    }
}

public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword, Guid CurrentSessionId) : IRequest;
public sealed class ChangePasswordHandler(ILedgerDbContext db, IUserContext current, IPasswordService passwords, ILocalDate clock) : IRequestHandler<ChangePasswordCommand>
{
    public async Task Handle(ChangePasswordCommand r, CancellationToken ct)
    {
        ApplicationRules.ValidatePassword(r.NewPassword); var user = await db.Users.SingleAsync(x => x.Id == current.UserId, ct);
        if (!passwords.Verify(r.CurrentPassword, user.PasswordHash)) throw AppProblem.Validation("currentPassword", "Current password is incorrect.");
        user.PasswordHash = passwords.Hash(r.NewPassword); user.PasswordUpdatedAt = clock.UtcNow;
        var sessions = await db.RefreshSessions.Where(x => x.UserId == user.Id && x.Id != r.CurrentSessionId && x.RevokedAt == null).ToListAsync(ct); foreach (var s in sessions) s.RevokedAt = clock.UtcNow;
        db.AuditRecords.Add(new AuditRecord { ActorId = user.Id, Action = "auth.password_changed" }); await db.SaveChangesAsync(ct);
    }
}
