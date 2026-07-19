import { CommonModule } from "@angular/common";
import { A11yModule } from "@angular/cdk/a11y";
import {
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  Routes,
} from "@angular/router";
import {
  AuthStore,
  DisplayPreferencesService,
  LedgerApi,
  RealtimeService,
  requireNeedsOnboarding,
  requireOnboarded,
  requireAuth,
} from "@ledger/api";
import { localCalendarDate } from "./date.utils";

@Component({
  selector: "ledger-root",
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  template: `
    <svg width="0" height="0" class="sr-only" aria-hidden="true">
      <defs>
        <linearGradient id="auroraGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="var(--aurora-start)"/><stop offset="52%" stop-color="var(--aurora-mid)"/><stop offset="100%" stop-color="var(--aurora-end)"/></linearGradient>
        <linearGradient id="auChartArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--viz-2)" stop-opacity=".36"/><stop offset="100%" stop-color="var(--viz-2)" stop-opacity="0"/></linearGradient>
      </defs>
    </svg>
    <a class="skip-link" href="#main">Skip to content</a>
    @if (auth.accessToken()) {
      <div class="app-frame">
        <main id="main" class="app-screen">
          <div class="app-scroll"><router-outlet /></div>
        </main>
        @if (!focusedFlow()) {
        <nav class="au-bottomnav app-bottomnav" aria-label="Primary">
          <a class="app-rail-brand" routerLink="/dashboard"
            ><span class="app-rail-mark"></span>Ledger</a
          >
          <a class="au-navitem" routerLink="/dashboard" routerLinkActive="is-active"
            ><svg class="au-icon"><use href="#i-home" /></svg>Home</a
          >
          <a class="au-navitem" routerLink="/trends" routerLinkActive="is-active"
            ><svg class="au-icon"><use href="#i-activity" /></svg>Trends</a
          >
          <button
            #quickButton
            type="button"
            class="app-navfab"
            aria-label="Log weight"
            (click)="openQuick()"
          ><svg class="au-icon"><use href="#i-plus" /></svg></button>
          <a class="au-navitem" routerLink="/badges" routerLinkActive="is-active"
            ><svg class="au-icon"><use href="#i-trophy" /></svg>Badges</a
          >
          <a class="au-navitem" routerLink="/account" routerLinkActive="is-active"
            ><svg class="au-icon"><use href="#i-user" /></svg>Profile</a
          >
        </nav>
        }
      </div>
    } @else {
      <main id="main" class="auth-shell"><router-outlet /></main>
    }
    @if (quickOpen()) {
      <div class="au-sheet-scrim is-open" (click)="closeQuick()">
        <section
          class="au-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="$event.stopPropagation()"
        >
          <div class="au-sheet-grip"></div>
          <div class="au-row-flex au-between">
            <div><div class="au-eyebrow">Today</div><h2 id="quick-title">Quick weigh-in</h2></div>
            <button
              class="au-icon-btn"
              type="button"
              (click)="closeQuick()"
              aria-label="Close"
            >
              <svg class="au-icon"><use href="#i-x" /></svg>
            </button>
          </div>
          <form class="quick-form" [formGroup]="quickForm" (ngSubmit)="saveQuick()">
            <div class="weigh-stepper" aria-label="Weight in {{ display.unitLabel }}">
              <button class="weigh-stepper-btn" type="button" (click)="adjustQuick(-0.1)" aria-label="Decrease by 0.1"><svg class="au-icon"><use href="#i-minus" /></svg></button>
              <label class="au-bignum-field"><span class="sr-only">Weight</span><input class="au-bignum" type="text" inputmode="decimal" formControlName="weightKg" /><span class="au-bignum-unit">{{ display.unitLabel }}</span></label>
              <button class="weigh-stepper-btn" type="button" (click)="adjustQuick(0.1)" aria-label="Increase by 0.1"><svg class="au-icon"><use href="#i-plus" /></svg></button>
            </div>
            <label class="au-field"
              ><span class="au-label">Note <small>optional</small></span
              ><div class="au-input-wrap"><textarea class="au-input" maxlength="280" formControlName="note"></textarea></div>
            </label>
            @if (quickError()) {
              <p class="au-help is-error" role="alert">{{ quickError() }}</p>
            }
            <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="quickForm.invalid">
              <svg class="au-icon"><use href="#i-check" /></svg> Save weigh-in
            </button>
          </form>
        </section>
      </div>
    }
  `,
})
export class AppComponent {
  readonly auth = inject(AuthStore);
  readonly display = inject(DisplayPreferencesService);
  private readonly realtime = inject(RealtimeService);
  private readonly api = inject(LedgerApi);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  @ViewChild("quickButton") quickButton?: ElementRef<HTMLButtonElement>;
  quickOpen = signal(false);
  quickError = signal("");
  quickForm = this.fb.nonNullable.group({
    weightKg: [
      75,
      [Validators.required, Validators.min(20), Validators.max(1102)],
    ],
    note: [""],
  });
  constructor() {
    effect(() => {
      if (this.auth.accessToken()) {
        void this.realtime.connect();
        this.api.preferences().subscribe((p) => this.display.apply(p));
      }
    });
    effect(() => {
      this.display.preferences().unit;
      if (this.quickForm.pristine)
        this.quickForm.controls.weightKg.setValue(this.display.fromKg(75));
    });
  }
  focusedFlow(): boolean {
    return this.router.url === "/welcome" || this.router.url.startsWith("/onboarding");
  }
  closeQuick(): void {
    this.quickOpen.set(false);
    queueMicrotask(() => this.quickButton?.nativeElement.focus());
  }
  openQuick(): void {
    this.api.dashboard().subscribe({
      next: (dashboard) => {
        this.quickForm.controls.weightKg.setValue(
          this.display.fromKg(dashboard.progress.currentWeightKg),
        );
        this.quickOpen.set(true);
      },
      error: () => this.quickOpen.set(true),
    });
  }
  adjustQuick(amount: number): void {
    this.quickForm.controls.weightKg.setValue(
      Math.round((Number(this.quickForm.controls.weightKg.value) + amount) * 10) / 10,
    );
  }
  saveQuick(): void {
    if (this.quickForm.invalid) return;
    const weightKg = this.display.toKg(this.quickForm.controls.weightKg.value);
    if (weightKg < 20 || weightKg > 500) {
      this.quickError.set(
        `Enter a weight between ${this.display.fromKg(20)} and ${this.display.fromKg(500)} ${this.display.unitLabel}.`,
      );
      return;
    }
    this.quickError.set("");
    this.api
      .logWeight({
        date: localCalendarDate(),
        weightKg,
        note: this.quickForm.controls.note.value,
      })
      .subscribe(() => this.closeQuick());
  }
}

export const routes: Routes = [
  {
    path: "sign-in",
    loadComponent: () => import("./auth.pages").then((m) => m.SignInPage),
  },
  {
    path: "register",
    loadComponent: () => import("./auth.pages").then((m) => m.RegisterPage),
  },
  {
    path: "forgot-password",
    loadComponent: () => import("./auth.pages").then((m) => m.ForgotPage),
  },
  {
    path: "reset-password",
    loadComponent: () => import("./auth.pages").then((m) => m.ResetPage),
  },
  {
    path: "verify-email",
    loadComponent: () => import("./auth.pages").then((m) => m.VerifyPage),
  },
  {
    path: "welcome",
    loadComponent: () => import("./feature.pages").then((m) => m.WelcomePage),
    canActivate: [requireNeedsOnboarding],
  },
  {
    path: "onboarding",
    loadComponent: () =>
      import("./feature.pages").then((m) => m.OnboardingPage),
    canActivate: [requireNeedsOnboarding],
  },
  {
    path: "onboarding/profile",
    loadComponent: () => import("./feature.pages").then((m) => m.ProfileSetupPage),
    canActivate: [requireAuth],
  },
  {
    path: "dashboard",
    loadComponent: () => import("./feature.pages").then((m) => m.DashboardPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "log",
    loadComponent: () => import("./feature.pages").then((m) => m.LogPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "history",
    loadComponent: () => import("./feature.pages").then((m) => m.HistoryPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "trends",
    loadComponent: () => import("./feature.pages").then((m) => m.TrendsPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "goal",
    loadComponent: () => import("./feature.pages").then((m) => m.GoalPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "badges",
    loadComponent: () => import("./feature.pages").then((m) => m.BadgesPage),
    canActivate: [requireOnboarded],
  },
  {
    path: "account",
    loadComponent: () => import("./feature.pages").then((m) => m.AccountPage),
    canActivate: [requireOnboarded],
  },
  { path: "", pathMatch: "full", redirectTo: "dashboard" },
  { path: "**", redirectTo: "dashboard" },
];
