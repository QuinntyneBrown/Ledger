using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Ledger.Application;
using Ledger.Domain;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using WebPush;

namespace Ledger.Infrastructure;

public sealed class PasswordService : IPasswordService
{
    private const int Iterations = 210_000;
    public string Hash(string password) { var salt = RandomNumberGenerator.GetBytes(16); var value = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32); return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(value)}"; }
    public bool Verify(string password, string hash) { try { var p = hash.Split('$'); var salt = Convert.FromBase64String(p[2]); var expected = Convert.FromBase64String(p[3]); var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, int.Parse(p[1]), HashAlgorithmName.SHA256, 32); return CryptographicOperations.FixedTimeEquals(expected, actual); } catch (Exception) { return false; } }
}

public sealed class TokenService(IConfiguration configuration) : ITokenService
{
    private readonly byte[] key = Encoding.UTF8.GetBytes(configuration["Jwt:Key"] ?? "development-only-key-change-this-32-bytes");
    public string CreateAccessToken(User user, DateTimeOffset expiresAt)
    {
        var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(configuration["Jwt:Issuer"] ?? "ledger", configuration["Jwt:Audience"] ?? "ledger-app", [new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())], expires: expiresAt.UtcDateTime, signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
    public string CreateOpaqueToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    public string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public sealed class SystemLocalDate : ILocalDate
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
    public DateOnly Today(string timeZone) { try { var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZone); return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(UtcNow, zone).DateTime); } catch (TimeZoneNotFoundException) { return DateOnly.FromDateTime(UtcNow.UtcDateTime); } }
}

public sealed class SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(string email, string subject, string text, CancellationToken ct)
    {
        var host = configuration["Smtp:Host"]; if (string.IsNullOrWhiteSpace(host)) { logger.LogInformation("Email suppressed in unconfigured environment: {Subject} to {EmailDomain}", subject, email.Split('@').LastOrDefault()); return; }
        using var message = new MailMessage(configuration["Smtp:From"] ?? "hello@ledger.local", email, subject, text); using var client = new SmtpClient(host, configuration.GetValue("Smtp:Port", 1025)) { EnableSsl = configuration.GetValue("Smtp:UseTls", false) };
        var username = configuration["Smtp:Username"]; if (!string.IsNullOrEmpty(username)) client.Credentials = new NetworkCredential(username, configuration["Smtp:Password"]); await client.SendMailAsync(message, ct);
    }
}

public sealed class AppLinks(IConfiguration configuration) : IAppLinks
{
    private string BaseUrl => (configuration["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');
    public string VerifyEmail(string token) => $"{BaseUrl}/verify-email?token={Uri.EscapeDataString(token)}";
    public string ResetPassword(string token) => $"{BaseUrl}/reset-password?token={Uri.EscapeDataString(token)}";
}

public sealed class LedgerHub : Hub
{
    public override async Task OnConnectedAsync() { var userId = Context.UserIdentifier; if (!string.IsNullOrWhiteSpace(userId)) await Groups.AddToGroupAsync(Context.ConnectionId, userId); await base.OnConnectedAsync(); }
}
public sealed class SignalRNotifier(IHubContext<LedgerHub> hub) : IRealtimeNotifier
{
    public Task SendAsync(Guid userId, object change, CancellationToken ct) => hub.Clients.Group(userId.ToString()).SendAsync("change", change, ct);
}

public sealed class FileAvatarStore(IConfiguration configuration) : IAvatarStore
{
    public async Task<string> SaveAsync(Guid userId, Stream content, string contentType, CancellationToken ct)
    {
        if (contentType is not ("image/jpeg" or "image/png" or "image/webp")) throw AppProblem.Validation("avatar", "Use a JPEG, PNG, or WebP image.");
        var root = configuration["Storage:AvatarPath"] ?? Path.Combine(AppContext.BaseDirectory, "avatars"); Directory.CreateDirectory(root);
        using var image = await Image.LoadAsync(content, ct); if (image.Width > 4096 || image.Height > 4096) throw AppProblem.Validation("avatar", "Image dimensions are too large.");
        var name = $"{userId:N}-{Guid.NewGuid():N}.jpg"; var path = Path.Combine(root, name); await image.SaveAsJpegAsync(path, new JpegEncoder { Quality = 88 }, ct); return $"/avatars/{name}";
    }
}

public sealed class VapidKeyProvider : IVapidKeys
{
    public VapidKeyProvider(IConfiguration configuration)
    {
        var publicKey = configuration["Vapid:PublicKey"]; var privateKey = configuration["Vapid:PrivateKey"];
        if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey)) { var generated = VapidHelper.GenerateVapidKeys(); publicKey = generated.PublicKey; privateKey = generated.PrivateKey; }
        PublicKey = publicKey; PrivateKey = privateKey; Subject = configuration["Vapid:Subject"] ?? "mailto:hello@ledger.local";
    }
    public string PublicKey { get; }
    public string PrivateKey { get; }
    public string Subject { get; }
}

public sealed class WebPushSender(IVapidKeys keys) : IWebPushSender
{
    public async Task SendAsync(Ledger.Domain.PushSubscription subscription, string title, string body, CancellationToken ct)
    {
        var target = new WebPush.PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth); var vapid = new VapidDetails(keys.Subject, keys.PublicKey, keys.PrivateKey); using var client = new WebPushClient();
        await client.SendNotificationAsync(target, System.Text.Json.JsonSerializer.Serialize(new { title, body, url = "/log" }), vapid, ct);
    }
}

public sealed class ReminderWorker(IServiceScopeFactory scopes, ILocalDate clock, ILogger<ReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>(); var push = scope.ServiceProvider.GetRequiredService<IWebPushSender>(); var prefs = await db.Preferences.Where(x => x.ReminderEnabled).ToListAsync(stoppingToken);
                foreach (var p in prefs)
                {
                    TimeZoneInfo zone; try { zone = TimeZoneInfo.FindSystemTimeZoneById(p.TimeZone); } catch { zone = TimeZoneInfo.Utc; }
                    var local = TimeZoneInfo.ConvertTime(clock.UtcNow, zone); var time = TimeOnly.FromDateTime(local.DateTime);
                    if (time.Hour != p.ReminderTime.Hour || time.Minute != p.ReminderTime.Minute || p.IsWithinQuietHours(time)) continue; var today = DateOnly.FromDateTime(local.DateTime); if (p.LastReminderSentOn == today || await db.WeighIns.AnyAsync(x => x.UserId == p.UserId && x.Date == today, stoppingToken)) continue;
                    var subscriptions = await db.PushSubscriptions.Where(x => x.UserId == p.UserId).ToListAsync(stoppingToken); foreach (var s in subscriptions) await push.SendAsync(s, "Time for your weigh-in", "A small honest entry keeps your trend useful.", stoppingToken); if (subscriptions.Count > 0) { p.LastReminderSentOn = today; await db.SaveChangesAsync(stoppingToken); }
                }
            }
            catch (Exception ex) { logger.LogError(ex, "Reminder evaluation failed"); }
        }
    }
}

public sealed class SyncRetentionWorker(IServiceScopeFactory scopes, ILocalDate clock, ILogger<SyncRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        do
        {
            try { using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>(); var removed = await db.SyncChanges.Where(x => x.ServerTimestamp < clock.UtcNow.AddDays(-30)).ExecuteDeleteAsync(stoppingToken); if (removed > 0) logger.LogInformation("Expired {Count} synchronization feed records", removed); }
            catch (Exception ex) { logger.LogError(ex, "Synchronization retention cleanup failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

public static class InfrastructureRegistration
{
    public static IServiceCollection AddLedgerInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("Ledger") ?? "Server=(localdb)\\mssqllocaldb;Database=Ledger;Trusted_Connection=True;TrustServerCertificate=True";
        services.AddDbContext<LedgerDbContext>(o => o.UseSqlServer(connection)); services.AddScoped<ILedgerDbContext>(x => x.GetRequiredService<LedgerDbContext>());
        services.AddSingleton<IPasswordService, PasswordService>(); services.AddSingleton<ITokenService, TokenService>(); services.AddSingleton<ILocalDate, SystemLocalDate>(); services.AddSingleton<IVapidKeys, VapidKeyProvider>(); services.AddSingleton<IAppLinks, AppLinks>(); services.AddScoped<IEmailSender, SmtpEmailSender>(); services.AddScoped<IRealtimeNotifier, SignalRNotifier>(); services.AddScoped<IAvatarStore, FileAvatarStore>(); services.AddScoped<IWebPushSender, WebPushSender>(); services.AddHostedService<ReminderWorker>(); services.AddHostedService<SyncRetentionWorker>(); return services;
    }
}
