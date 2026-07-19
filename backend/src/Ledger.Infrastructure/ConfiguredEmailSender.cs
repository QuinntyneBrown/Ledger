using System.Net;
using System.Net.Mail;
using Azure;
using Azure.Communication.Email;
using Ledger.Application;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ledger.Infrastructure;

public sealed class ConfiguredEmailSender(IConfiguration configuration, ILogger<ConfiguredEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(string email, string subject, string text, CancellationToken ct)
    {
        var communicationConnection = configuration["AzureCommunication:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(communicationConnection))
        {
            var sender = configuration["Smtp:From"] ?? throw new InvalidOperationException("Smtp:From is required for Azure Communication Services email.");
            var content = new EmailContent(subject) { PlainText = text };
            var operation = await new EmailClient(communicationConnection).SendAsync(WaitUntil.Completed, new EmailMessage(sender, email, content), ct);
            logger.LogInformation("Queued email {OperationId} for {EmailDomain}", operation.Id, email.Split('@').LastOrDefault());
            return;
        }

        var host = configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogInformation("Email suppressed in unconfigured environment: {Subject} to {EmailDomain}", subject, email.Split('@').LastOrDefault());
            return;
        }

        using var message = new MailMessage(configuration["Smtp:From"] ?? "hello@ledger.local", email, subject, text);
        using var client = new SmtpClient(host, configuration.GetValue("Smtp:Port", 1025)) { EnableSsl = configuration.GetValue("Smtp:UseTls", false) };
        var username = configuration["Smtp:Username"];
        if (!string.IsNullOrEmpty(username)) client.Credentials = new NetworkCredential(username, configuration["Smtp:Password"]);
        await client.SendMailAsync(message, ct);
    }
}
