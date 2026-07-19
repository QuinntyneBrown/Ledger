using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using Ledger.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Ledger.IntegrationTests;

public sealed class LedgerFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"ledger-{Guid.NewGuid()}";
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing"); builder.UseSetting("Database:MigrateOnStartup", "false"); builder.UseSetting("Jwt:Key", "integration-test-signing-key-at-least-32-bytes");
        builder.ConfigureTestServices(services => { services.RemoveAll<DbContextOptions<LedgerDbContext>>(); services.RemoveAll<IDbContextOptionsConfiguration<LedgerDbContext>>(); services.RemoveAll<LedgerDbContext>(); services.AddDbContext<LedgerDbContext>(o => o.UseInMemoryDatabase(databaseName)); });
    }
}

public sealed class ApiTests(LedgerFactory factory) : IClassFixture<LedgerFactory>
{
    // Traces to: L2-083, L2-088
    [Fact]
    public async Task Liveness_and_root_are_available()
    {
        var client = factory.CreateClient(); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/")).StatusCode);
    }

    // Traces to: L2-001, L2-002, L2-068
    [Fact]
    public async Task Registration_validates_terms_and_password()
    {
        var client = factory.CreateClient(); var response = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = "Test Member", email = "member@example.test", password = "weak", termsAccepted = false });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode); Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    // Traces to: L2-005, L2-071
    [Fact]
    public async Task Forgot_password_is_enumeration_safe()
    {
        var client = factory.CreateClient(); var response = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "missing@example.test" }); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Sign_out_expires_refresh_cookie_on_its_original_path()
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") }); var email = $"sign-out-{Guid.NewGuid():N}@example.test";
        var registration = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = "Sign Out Member", email, password = "Strong!234", termsAccepted = true }); registration.EnsureSuccessStatusCode();
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>(); var user = await db.Users.SingleAsync(x => x.Email == email); user.EmailVerified = true; await db.SaveChangesAsync(); }

        var signIn = await client.PostAsJsonAsync("/api/v1/auth/sign-in", new { email, password = "Strong!234" }); signIn.EnsureSuccessStatusCode();
        var signInCookies = signIn.Headers.GetValues("Set-Cookie").ToArray();
        var csrfCookie = signInCookies.Single(x => x.StartsWith("ledger_csrf=", StringComparison.OrdinalIgnoreCase)).Split(';')[0];
        client.DefaultRequestHeaders.Add("X-CSRF", csrfCookie[(csrfCookie.IndexOf('=') + 1)..]);

        var signOut = await client.PostAsJsonAsync("/api/v1/auth/sign-out", new { });
        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        var deletedCookies = signOut.Headers.GetValues("Set-Cookie").ToArray();
        Assert.Contains(deletedCookies, cookie => cookie.StartsWith("ledger_refresh=", StringComparison.OrdinalIgnoreCase) && cookie.Contains("path=/api/v1/auth", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(deletedCookies, cookie => cookie.StartsWith("ledger_csrf=", StringComparison.OrdinalIgnoreCase) && cookie.Contains("path=/", StringComparison.OrdinalIgnoreCase));
    }

    // Traces to: L2-001, L2-003, L2-004, L2-008, L2-010, L2-011, L2-012, L2-013, L2-015, L2-016, L2-017, L2-021, L2-023, L2-025, L2-026, L2-028, L2-030, L2-033, L2-034, L2-035, L2-038, L2-039, L2-040, L2-045, L2-048, L2-055, L2-067, L2-068, L2-074, L2-076, L2-088, L2-089
    [Fact]
    public async Task Member_journey_flows_through_versioned_owner_scoped_api()
    {
        var client = factory.CreateClient(); var email = $"journey-{Guid.NewGuid():N}@example.test";
        var registration = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = "Journey Member", email, password = "Strong!234", termsAccepted = true }); Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>(); var user = await db.Users.SingleAsync(x => x.Email == email); user.EmailVerified = true; await db.SaveChangesAsync(); }
        var signIn = await client.PostAsJsonAsync("/api/v1/auth/sign-in", new { email, password = "Strong!234" }); signIn.EnsureSuccessStatusCode(); using var authJson = JsonDocument.Parse(await signIn.Content.ReadAsStringAsync()); var access = authJson.RootElement.GetProperty("accessToken").GetString(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", access);
        var target = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(90); var onboarding = await client.PostAsJsonAsync("/api/v1/onboarding/complete", new { unit = "Kg", currentWeightKg = 80.0m, goalWeightKg = 70.0m, targetDate = target, timeZone = "UTC" }); onboarding.EnsureSuccessStatusCode();
        var badges = await client.GetFromJsonAsync<JsonElement[]>("/api/v1/milestones"); var firstEntry = badges!.Single(x => x.GetProperty("type").GetString() == "FirstEntry"); Assert.True(firstEntry.GetProperty("earned").GetBoolean()); var firstEntryId = firstEntry.GetProperty("id").GetGuid();
        var acknowledge = await client.PostAsJsonAsync($"/api/v1/milestones/{firstEntryId}/acknowledge", new { }); Assert.Equal(HttpStatusCode.NoContent, acknowledge.StatusCode);
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>(); var user = await db.Users.SingleAsync(x => x.Email == email); Assert.NotNull((await db.Milestones.SingleAsync(x => x.UserId == user.Id && x.Type == Ledger.Domain.BadgeType.FirstEntry)).AcknowledgedAt); Assert.Equal(1, (await db.Streaks.SingleAsync(x => x.UserId == user.Id)).Current); }
        var today = DateOnly.FromDateTime(DateTime.UtcNow); var log = await client.PostAsJsonAsync("/api/v1/weigh-ins", new { date = today, weightKg = 79.8m, note = "Steady <script>data</script>" }); log.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/dashboard")).StatusCode); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/trends?range=OneMonth")).StatusCode); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/weigh-ins?sort=Newest&page=1&pageSize=50")).StatusCode); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/milestones")).StatusCode);
    }
}
