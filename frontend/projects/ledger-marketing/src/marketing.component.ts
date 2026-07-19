import { isPlatformBrowser } from "@angular/common";
import { Component, inject, PLATFORM_ID, signal } from "@angular/core";
import { RouterLink, RouterOutlet, Routes } from "@angular/router";

const applicationUrl = (): string =>
  typeof location !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4200"
    : "https://ledger-app-qbrown.azurewebsites.net";

@Component({
  selector: "ledger-marketing",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `<header class="site-header">
      <a routerLink="/" class="wordmark">◒ Ledger</a>
      <nav aria-label="Public">
        <a routerLink="/">Product</a><a routerLink="/privacy">Privacy</a
        ><a class="button secondary" [href]="appUrl + '/sign-in'"
          >Sign in</a
        >
      </nav>
    </header>
    <main><router-outlet /></main>
    <footer>
      <a routerLink="/terms">Terms</a><a routerLink="/privacy">Privacy</a
      ><span>© 2026 Ledger</span>
    </footer>
    @if (showConsent()) {
      <aside class="consent" role="dialog" aria-label="Cookie preferences">
        <p>
          Ledger uses necessary storage for your consent choice. Optional
          analytics loads only if you allow it.
        </p>
        <div>
          <button class="button secondary" (click)="choose('denied')">
            Necessary only</button
          ><button class="button primary" (click)="choose('granted')">
            Allow analytics
          </button>
        </div>
      </aside>
    }`,
})
export class MarketingComponent {
  private platform = inject(PLATFORM_ID);
  readonly appUrl = applicationUrl();
  showConsent = signal(false);
  constructor() {
    if (isPlatformBrowser(this.platform))
      this.showConsent.set(!localStorage.getItem("ledger.consent"));
  }
  choose(choice: string): void {
    localStorage.setItem(
      "ledger.consent",
      JSON.stringify({ choice, decidedAt: new Date().toISOString() }),
    );
    this.showConsent.set(false);
  }
}

@Component({
  standalone: true,
  imports: [],
  template: `<section class="hero">
      <p class="eyebrow">A ruthlessly simple weight tracker</p>
      <h1>Weight,<br /><em>kept honestly.</em></h1>
      <p class="lead">
        No noise. No judgment. Just a calm record of where you are and where
        you’re heading.
      </p>
      <div class="hero-actions">
        <a class="button primary" [href]="appUrl + '/register'"
          >Start your ledger</a
        ><a class="button secondary" href="#how">See how it works</a>
      </div>
      <div class="product-card" aria-label="Ledger dashboard preview">
        <span>Today</span><strong>74.8 <small>kg</small></strong
        ><i></i>
        <p>42% toward your goal</p>
      </div>
    </section>
    <section id="how" class="features">
      <p class="eyebrow">The whole loop</p>
      <h2>Four things. Done beautifully.</h2>
      <div>
        <article>
          <b>01</b>
          <h3>Set a goal</h3>
          <p>Choose a destination and a date. Ledger keeps the math honest.</p>
        </article>
        <article>
          <b>02</b>
          <h3>Log a weigh-in</h3>
          <p>
            One number a day, with an optional note. Nothing between you and the
            habit.
          </p>
        </article>
        <article>
          <b>03</b>
          <h3>Read the trend</h3>
          <p>
            See the signal through daily noise with a calm, accessible trend.
          </p>
        </article>
        <article>
          <b>04</b>
          <h3>Mark progress</h3>
          <p>
            Streaks and milestones recognize consistency without turning health
            into a game.
          </p>
        </article>
      </div>
    </section>
    <section class="cta">
      <h2>Your weight is data.<br />Your progress is a story.</h2>
      <a class="button primary" [href]="appUrl + '/register'"
        >Create your free account</a
      >
    </section>`,
})
export class LandingPage {
  readonly appUrl = applicationUrl();
}

@Component({
  standalone: true,
  template: `<article class="legal">
    <p class="eyebrow">Legal draft — review required</p>
    <h1>Terms of Service</h1>
    <p>Effective July 18, 2026</p>
    <h2>Using Ledger</h2>
    <p>
      Ledger provides personal weight-tracking tools. It is not medical advice,
      diagnosis, or treatment. Use accurate account information, keep
      credentials secure, and use the service lawfully.
    </p>
    <h2>Your content</h2>
    <p>
      You retain ownership of the information you enter. You grant Ledger the
      limited permission needed to store, process, synchronize, display, export,
      and delete it at your direction.
    </p>
    <h2>Availability and responsibility</h2>
    <p>
      We work to keep Ledger secure and available, but the service is provided
      without a promise of uninterrupted operation. To the extent permitted by
      law, Ledger is not responsible for indirect or consequential loss.
    </p>
    <h2>Closing an account</h2>
    <p>
      You can export or erase tracking data and delete your account from
      Settings. Account deletion revokes active sessions and irreversibly
      anonymizes the account.
    </p>
    <h2>Contact</h2>
    <p>Questions may be sent to support@ledger.example.</p>
  </article>`,
})
export class TermsPage {}

@Component({
  standalone: true,
  template: `<article class="legal">
    <p class="eyebrow">Legal draft — review required</p>
    <h1>Privacy Policy</h1>
    <p>Effective July 18, 2026</p>
    <h2>Data we process</h2>
    <p>
      Ledger stores your name, email, password hash, profile details,
      preferences, goals, weigh-ins, notes, milestones, reminders, sessions, and
      security audit events. Passwords and raw authentication tokens are never
      stored.
    </p>
    <h2>Why we process it</h2>
    <p>
      We use this information to operate your account, calculate your private
      trends, synchronize your devices, send requested reminders and security
      emails, prevent abuse, and diagnose failures.
    </p>
    <h2>Retention and deletion</h2>
    <p>
      Tracking data remains until you erase it. Account deletion removes or
      irreversibly anonymizes personal data; minimal non-personal security audit
      facts may be retained where legally necessary. Reconciliation events
      expire after 30 days.
    </p>
    <h2>Sharing and transfers</h2>
    <p>
      Data is disclosed only to service providers necessary to host, email,
      notify, monitor, and secure Ledger, under appropriate safeguards. Ledger
      does not sell personal information.
    </p>
    <h2>Your choices</h2>
    <p>
      You can export, correct, or delete your information in Settings. Optional
      analytics does not load until you consent, and you may change that choice
      by clearing the saved consent preference.
    </p>
    <h2>Contact</h2>
    <p>Privacy requests may be sent to privacy@ledger.example.</p>
  </article>`,
})
export class PrivacyPage {}
export const marketingRoutes: Routes = [
  { path: "", component: LandingPage },
  { path: "terms", component: TermsPage },
  { path: "privacy", component: PrivacyPage },
  { path: "**", redirectTo: "" },
];
