using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Ledger.Api;
using Ledger.Application;
using Ledger.Domain;
using Ledger.Infrastructure;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpContextAccessor(); builder.Services.AddScoped<IUserContext, HttpUserContext>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton<MetricsState>(); builder.Services.AddSingleton<ILedgerMetrics>(x => x.GetRequiredService<MetricsState>());
builder.Services.AddMediatR(c => c.RegisterServicesFromAssembly(typeof(RegisterCommand).Assembly)); builder.Services.AddLedgerInfrastructure(builder.Configuration); builder.Services.AddScoped<IEmailSender, ConfiguredEmailSender>();
// Leave room for multipart headers; the endpoint still enforces a 5 MB file.
builder.Services.Configure<FormOptions>(x => x.MultipartBodyLengthLimit = 6 * 1024 * 1024);
var jwtKey = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "development-only-key-change-this-32-bytes");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => { o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true, ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "ledger", ValidAudience = builder.Configuration["Jwt:Audience"] ?? "ledger-app", IssuerSigningKey = new SymmetricSecurityKey(jwtKey), NameClaimType = ClaimTypes.NameIdentifier }; o.Events = new JwtBearerEvents { OnMessageReceived = c => { if (c.HttpContext.Request.Path.StartsWithSegments("/hubs/ledger")) c.Token = c.Request.Query["access_token"]; return Task.CompletedTask; } }; });
builder.Services.AddAuthorization(); builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.OnRejected = async (context, ct) => { context.HttpContext.Response.Headers.RetryAfter = "60"; await context.HttpContext.Response.WriteAsJsonAsync(new { code = "rate_limited", message = "Too many requests. Try again shortly." }, ct); }; o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })); o.AddPolicy("api", context => RateLimitPartition.GetFixedWindowLimiter(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })); });
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200", "http://localhost:4300"]; builder.Services.AddCors(o => o.AddPolicy("app", p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
var signalR = builder.Services.AddSignalR(); var redis = builder.Configuration.GetConnectionString("Redis"); if (!string.IsNullOrWhiteSpace(redis)) signalR.AddStackExchangeRedis(redis);
var health = builder.Services.AddHealthChecks().AddDbContextCheck<LedgerDbContext>(); if (!string.IsNullOrWhiteSpace(redis)) health.AddRedis(redis, name: "signalr-backplane"); builder.Services.AddOpenApi(); builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new OpenApiInfo { Title = "Ledger API", Version = "v1" }));
builder.Services.AddOpenTelemetry().WithTracing(x => x.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter()).WithMetrics(x => x.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter());

var app = builder.Build(); app.UseMiddleware<RequestMetricsMiddleware>(); app.UseMiddleware<ProblemMiddleware>(); app.UseMiddleware<SecurityHeadersMiddleware>(); if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
if (builder.Configuration.GetValue("Database:MigrateOnStartup", false)) { using var scope = app.Services.CreateScope(); await scope.ServiceProvider.GetRequiredService<LedgerDbContext>().Database.MigrateAsync(); }
app.UseCors("app"); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization(); app.UseStaticFiles();
var avatarPath = builder.Configuration["Storage:AvatarPath"];
if (!string.IsNullOrWhiteSpace(avatarPath))
{
    avatarPath = Path.IsPathRooted(avatarPath) ? avatarPath : Path.GetFullPath(avatarPath, app.Environment.ContentRootPath);
    builder.Configuration["Storage:AvatarPath"] = avatarPath;
    Directory.CreateDirectory(avatarPath);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(avatarPath), RequestPath = "/avatars" });
}
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }

var api = app.MapGroup("/api/v1"); var auth = api.MapGroup("/auth").RequireRateLimiting("auth");
auth.MapPost("/register", async (RegisterCommand command, ISender sender, CancellationToken ct) => Results.Created("/api/v1/auth/session", new { userId = await sender.Send(command, ct) }));
auth.MapPost("/verify-email", async (VerifyEmailCommand command, ISender sender, CancellationToken ct) => { await sender.Send(command, ct); return Results.NoContent(); });
auth.MapPost("/resend-verification", async (ResendVerificationCommand command, ISender sender, CancellationToken ct) => { await sender.Send(command, ct); return Results.Ok(new { message = "If verification is needed, we've sent a link." }); });
auth.MapPost("/sign-in", async (SignInCommand command, ISender sender, HttpContext http, CancellationToken ct) => { var result = await sender.Send(command, ct); SetSessionCookies(http, result.RefreshToken); return Results.Ok(result with { RefreshToken = string.Empty }); });
auth.MapPost("/refresh", async (ISender sender, HttpContext http, CancellationToken ct) => { ValidateCsrf(http); if (!http.Request.Cookies.TryGetValue("ledger_refresh", out var token)) throw new AppProblem(401, "invalid_session", "The session is no longer valid."); var result = await sender.Send(new RefreshCommand(token), ct); SetSessionCookies(http, result.RefreshToken); return Results.Ok(result with { RefreshToken = string.Empty }); });
auth.MapPost("/forgot-password", async (RequestPasswordResetCommand command, ISender sender, CancellationToken ct) => { await sender.Send(command, ct); return Results.Ok(new { message = "If that email exists, we've sent a link." }); });
auth.MapPost("/reset-password", async (ResetPasswordCommand command, ISender sender, CancellationToken ct) => { await sender.Send(command, ct); return Results.NoContent(); });
auth.MapPost("/change-password", async (ChangePasswordBody body, ISender sender, HttpContext http, LedgerDbContext db, ITokenService tokens, CancellationToken ct) => { Guid currentSessionId = Guid.Empty; if (http.Request.Cookies.TryGetValue("ledger_refresh", out var raw)) currentSessionId = await db.RefreshSessions.Where(x => x.TokenHash == tokens.HashToken(raw)).Select(x => x.Id).SingleOrDefaultAsync(ct); await sender.Send(new ChangePasswordCommand(body.CurrentPassword, body.NewPassword, currentSessionId), ct); return Results.NoContent(); }).RequireAuthorization();
auth.MapPost("/sign-out", async (LedgerDbContext db, HttpContext http, ITokenService tokens, ILocalDate clock, CancellationToken ct) => { ValidateCsrf(http); if (http.Request.Cookies.TryGetValue("ledger_refresh", out var raw)) { var hash = tokens.HashToken(raw); var s = await db.RefreshSessions.SingleOrDefaultAsync(x => x.TokenHash == hash, ct); if (s is not null) { s.RevokedAt = clock.UtcNow; await db.SaveChangesAsync(ct); } } ClearSessionCookies(http); return Results.NoContent(); });

var secured = api.MapGroup(string.Empty).RequireAuthorization().RequireRateLimiting("api");
secured.MapGet("/session", async (LedgerDbContext db, IUserContext user, CancellationToken ct) => { var u = await db.Users.AsNoTracking().SingleAsync(x => x.Id == user.UserId, ct); return Results.Ok(new { u.Id, u.Name, u.Email, u.EmailVerified, onboarded = await db.Goals.AnyAsync(x => x.UserId == u.Id, ct) }); });
secured.MapGet("/onboarding", (ISender s, CancellationToken ct) => s.Send(new GetOnboardingQuery(), ct)); secured.MapPatch("/onboarding", (SaveOnboardingDraftCommand c, ISender s, CancellationToken ct) => s.Send(c, ct)); secured.MapPost("/onboarding/complete", (CompleteOnboardingCommand c, ISender s, CancellationToken ct) => s.Send(c, ct));
secured.MapPost("/weigh-ins", (LogWeighInCommand c, ISender s, CancellationToken ct) => s.Send(c, ct)); secured.MapPut("/weigh-ins/{id:guid}", (Guid id, EditBody b, ISender s, CancellationToken ct) => s.Send(new EditWeighInCommand(id, b.WeightKg, b.Note), ct)); secured.MapDelete("/weigh-ins/{id:guid}", (Guid id, ISender s, CancellationToken ct) => s.Send(new DeleteWeighInCommand(id), ct)); secured.MapGet("/weigh-ins", (HistorySort sort, int page, int pageSize, ISender s, CancellationToken ct) => s.Send(new GetHistoryQuery(sort, page == 0 ? 1 : page, pageSize == 0 ? 50 : pageSize), ct));
secured.MapGet("/goals/progress", (ISender s, CancellationToken ct) => s.Send(new GetGoalProgressQuery(), ct)); secured.MapPut("/goals", (SetGoalCommand c, ISender s, CancellationToken ct) => s.Send(c, ct)); secured.MapGet("/dashboard", (ISender s, CancellationToken ct) => s.Send(new GetDashboardQuery(), ct)); secured.MapGet("/trends", (TimeRange range, ISender s, CancellationToken ct) => s.Send(new GetTrendsQuery(range), ct));
secured.MapGet("/milestones", (ISender s, CancellationToken ct) => s.Send(new GetBadgesQuery(), ct)); secured.MapPost("/milestones/{id:guid}/acknowledge", async (Guid id, LedgerDbContext db, IUserContext user, ILocalDate clock, CancellationToken ct) => { var m = await db.Milestones.SingleOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId, ct) ?? throw AppProblem.NotFound(); m.AcknowledgedAt = clock.UtcNow; await db.SaveChangesAsync(ct); return Results.NoContent(); });
secured.MapGet("/preferences", async (LedgerDbContext db, IUserContext user, CancellationToken ct) => (await db.Preferences.AsNoTracking().SingleAsync(x => x.UserId == user.UserId, ct)).ToDto()); secured.MapPatch("/preferences", (ChangePreferencesCommand c, ISender s, CancellationToken ct) => s.Send(c, ct)); secured.MapPut("/reminders", async (ScheduleReminderCommand c, ISender s, ReminderWorkerWakeSignal reminders, CancellationToken ct) => { var result = await s.Send(c, ct); reminders.Pulse(); return result; });
secured.MapPost("/push-subscriptions", async (PushSubscriptionBody b, LedgerDbContext db, IUserContext user, ReminderWorkerWakeSignal reminders, CancellationToken ct) => { var existing = await db.PushSubscriptions.SingleOrDefaultAsync(x => x.UserId == user.UserId && x.Endpoint == b.Endpoint, ct); if (existing is null) db.PushSubscriptions.Add(new PushSubscription { UserId = user.UserId, Endpoint = b.Endpoint, P256dh = b.P256dh, Auth = b.Auth }); else { existing.P256dh = b.P256dh; existing.Auth = b.Auth; } await db.SaveChangesAsync(ct); reminders.Pulse(); return Results.NoContent(); });
secured.MapGet("/push/public-key", (IVapidKeys keys) => Results.Ok(new { publicKey = keys.PublicKey }));
secured.MapGet("/profile", async (LedgerDbContext db, IUserContext user, CancellationToken ct) => { var u = await db.Users.AsNoTracking().SingleAsync(x => x.Id == user.UserId, ct); var g = await db.Goals.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.UserId, ct); var w = await db.WeighIns.AsNoTracking().Where(x => x.UserId == user.UserId).OrderByDescending(x => x.Date).FirstOrDefaultAsync(ct); return Results.Ok(new { u.Id, u.Name, u.Email, u.EmailVerified, u.HeightCm, u.AvatarUrl, u.MemberSince, bmi = u.HeightCm is not null && w is not null ? WeightMath.Bmi(w.WeightKg, u.HeightCm.Value) : (decimal?)null, goal = g?.ToDto() }); }); secured.MapPut("/profile", async (UpdateProfileCommand c, ISender s, CancellationToken ct) => { await s.Send(c, ct); return Results.NoContent(); });
secured.MapPost("/profile/avatar", async (IFormFile file, IAvatarStore storage, LedgerDbContext db, IUserContext current, CancellationToken ct) => { if (file.Length > 5 * 1024 * 1024) throw AppProblem.Validation("avatar", "Image must be 5 MB or smaller."); await using var stream = file.OpenReadStream(); var url = await storage.SaveAsync(current.UserId, stream, file.ContentType, ct); var user = await db.Users.SingleAsync(x => x.Id == current.UserId, ct); user.AvatarUrl = url; await db.SaveChangesAsync(ct); return Results.Ok(new { url }); }).DisableAntiforgery();
secured.MapGet("/account/export", async (ISender s, CancellationToken ct) => Results.File(await s.Send(new ExportDataQuery(), ct), "text/csv", "ledger-export.csv"));
secured.MapDelete("/account/data", async ([FromBody] DeleteConfirmation b, LedgerDbContext db, IUserContext user, CancellationToken ct) => { if (b.Confirmation != "DELETE") throw AppProblem.Validation("confirmation", "Type DELETE to continue."); await db.WeighIns.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); await db.Goals.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); await db.Milestones.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); await db.Streaks.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); await db.OnboardingDrafts.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); await db.SyncChanges.Where(x => x.UserId == user.UserId).ExecuteDeleteAsync(ct); db.AuditRecords.Add(new AuditRecord { ActorId = user.UserId, Action = "data.deleted" }); await db.SaveChangesAsync(ct); return Results.NoContent(); });
secured.MapDelete("/account", async ([FromBody] DeleteConfirmation b, LedgerDbContext db, IUserContext current, ILocalDate clock, CancellationToken ct) => { if (b.Confirmation != "DELETE") throw AppProblem.Validation("confirmation", "Type DELETE to continue."); var id = current.UserId; await db.WeighIns.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.Goals.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.Milestones.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.Streaks.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.RefreshSessions.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.OneTimeTokens.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.OnboardingDrafts.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.Preferences.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.PushSubscriptions.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); await db.SyncChanges.Where(x => x.UserId == id).ExecuteDeleteAsync(ct); var u = await db.Users.SingleAsync(x => x.Id == id, ct); u.Name = "Deleted member"; u.Email = $"deleted-{id:N}@invalid.local"; u.NormalizedEmail = u.Email.ToUpperInvariant(); u.PasswordHash = "deleted"; u.AvatarUrl = null; u.HeightCm = null; u.IsDeleted = true; db.AuditRecords.Add(new AuditRecord { ActorId = null, Action = "account.deleted", Timestamp = clock.UtcNow }); await db.SaveChangesAsync(ct); return Results.NoContent(); });
secured.MapGet("/sync/changes", async (DateTimeOffset? since, LedgerDbContext db, IUserContext user, CancellationToken ct) => await db.SyncChanges.AsNoTracking().Where(x => x.UserId == user.UserId && x.ServerTimestamp > (since ?? DateTimeOffset.MinValue)).OrderBy(x => x.ServerTimestamp).Take(1000).ToListAsync(ct));

app.MapHub<LedgerHub>("/hubs/ledger").RequireAuthorization(); app.MapHealthChecks("/health/live", new() { Predicate = _ => false }); app.MapHealthChecks("/health/ready"); app.MapGet("/api", () => Results.Ok(new { service = "Ledger API", version = "v1" }));
app.MapGet("/metrics", (MetricsState metrics) => Results.Text(metrics.Export(), "text/plain; version=0.0.4"));
var spaIndex = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot"), "index.html");
if (File.Exists(spaIndex))
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/hubs") || context.Request.Path.StartsWithSegments("/health") || context.Request.Path.StartsWithSegments("/metrics") || context.Request.Path.StartsWithSegments("/avatars"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(spaIndex);
    });
}
else
{
    app.MapGet("/", () => Results.Ok(new { service = "Ledger API", version = "v1" }));
}
app.Run();

static void SetSessionCookies(HttpContext http, string refresh) { var secure = !http.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(); http.Response.Cookies.Append("ledger_refresh", refresh, new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api/v1/auth", Expires = DateTimeOffset.UtcNow.AddDays(30) }); var csrf = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24)); http.Response.Cookies.Append("ledger_csrf", csrf, new CookieOptions { HttpOnly = false, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/", Expires = DateTimeOffset.UtcNow.AddDays(30) }); }
static void ClearSessionCookies(HttpContext http) { var secure = !http.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(); http.Response.Cookies.Delete("ledger_refresh", new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api/v1/auth" }); http.Response.Cookies.Delete("ledger_csrf", new CookieOptions { HttpOnly = false, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/" }); }
static void ValidateCsrf(HttpContext http) { var cookie = http.Request.Cookies["ledger_csrf"]; var header = http.Request.Headers["X-CSRF"].ToString(); if (string.IsNullOrEmpty(cookie) || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(cookie), Encoding.UTF8.GetBytes(header))) throw new AppProblem(400, "csrf_failed", "Request verification failed."); }

public sealed record EditBody(decimal WeightKg, string? Note);
public sealed record ChangePasswordBody(string CurrentPassword, string NewPassword);
public sealed record PushSubscriptionBody(string Endpoint, string P256dh, string Auth);
public sealed record DeleteConfirmation(string Confirmation);
public partial class Program;
