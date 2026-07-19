using System.Diagnostics;
using System.Security.Claims;
using Ledger.Application;
using Microsoft.AspNetCore.Mvc;

namespace Ledger.Api;

public sealed class HttpUserContext(IHttpContextAccessor accessor) : IUserContext
{
    private HttpContext Context => accessor.HttpContext ?? throw new InvalidOperationException("No active HTTP request.");
    public Guid UserId => Guid.TryParse(Context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Context.User.FindFirstValue("sub"), out var id) ? id : throw new AppProblem(401, "unauthorized", "Authentication is required.");
    public string? SourceIp => Context.Connection.RemoteIpAddress?.ToString();
    public string? UserAgent => Context.Request.Headers.UserAgent.ToString();
}

public sealed class ProblemMiddleware(RequestDelegate next, ILogger<ProblemMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try { await next(context); }
        catch (AppProblem ex) { await Write(context, ex.Status, ex.Code, ex.Message, ex.Errors); }
        catch (Exception ex) { logger.LogError(ex, "Unhandled request failure {CorrelationId}", Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier); await Write(context, 500, "unexpected_error", "Something went wrong. Please try again.", null); }
    }
    private static async Task Write(HttpContext context, int status, string code, string message, IReadOnlyDictionary<string, string[]>? errors)
    {
        context.Response.StatusCode = status; context.Response.ContentType = "application/problem+json";
        var details = new ProblemDetails { Status = status, Title = message, Type = $"https://ledger.local/problems/{code}", Instance = context.Request.Path };
        details.Extensions["code"] = code; details.Extensions["correlationId"] = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier; if (errors is not null && errors.Count > 0) details.Extensions["errors"] = errors;
        await context.Response.WriteAsJsonAsync(details, options: null, contentType: "application/problem+json");
    }
}

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task Invoke(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var h = context.Response.Headers;
            h.XContentTypeOptions = "nosniff";
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h.XFrameOptions = "DENY";
            h.ContentSecurityPolicy = context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/health") || context.Request.Path.StartsWithSegments("/metrics")
                ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
                : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
            return Task.CompletedTask;
        });
        await next(context);
    }
}

public sealed class MetricsState : ILedgerMetrics
{
    private long requests; private long errors; private long totalLatencyMs; private long weighIns; private long badges;
    public void RecordRequest(long elapsedMs, bool failed) { Interlocked.Increment(ref requests); Interlocked.Add(ref totalLatencyMs, elapsedMs); if (failed) Interlocked.Increment(ref errors); }
    public void RecordWeighIn(int badgesEarned) { Interlocked.Increment(ref weighIns); Interlocked.Add(ref badges, badgesEarned); }
    public string Export() { var count = Interlocked.Read(ref requests); var latency = Interlocked.Read(ref totalLatencyMs); return $"# TYPE ledger_http_requests_total counter\nledger_http_requests_total {count}\n# TYPE ledger_http_errors_total counter\nledger_http_errors_total {Interlocked.Read(ref errors)}\n# TYPE ledger_http_latency_average_ms gauge\nledger_http_latency_average_ms {(count == 0 ? 0 : latency / count)}\n# TYPE ledger_weigh_ins_logged_total counter\nledger_weigh_ins_logged_total {Interlocked.Read(ref weighIns)}\n# TYPE ledger_badges_earned_total counter\nledger_badges_earned_total {Interlocked.Read(ref badges)}\n"; }
}

public sealed class RequestMetricsMiddleware(RequestDelegate next)
{
    public async Task Invoke(HttpContext context, MetricsState metrics) { var started = Stopwatch.GetTimestamp(); try { await next(context); } finally { metrics.RecordRequest((long)Stopwatch.GetElapsedTime(started).TotalMilliseconds, context.Response.StatusCode >= 500); } }
}
