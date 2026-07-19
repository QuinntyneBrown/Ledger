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
  Routes,
} from "@angular/router";
import {
  AuthStore,
  DisplayPreferencesService,
  LedgerApi,
  RealtimeService,
  requireNeedsOnboarding,
  requireOnboarded,
} from "@ledger/api";

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
    <a class="skip-link" href="#main">Skip to content</a>
    @if (auth.accessToken()) {
      <div class="app-shell">
        <aside class="side-nav" aria-label="Primary">
          <a class="brand" routerLink="/dashboard">◒ <span>Ledger</span></a
          ><ng-container *ngTemplateOutlet="links" />
        </aside>
        <main id="main" class="app-main"><router-outlet /></main>
        <nav class="bottom-nav" aria-label="Primary">
          <ng-container *ngTemplateOutlet="links" />
        </nav>
        <button
          #quickButton
          type="button"
          class="quick-action"
          aria-label="Log a quick weigh-in"
          (click)="quickOpen.set(true)"
        >
          ＋
        </button>
      </div>
    } @else {
      <main id="main" class="auth-shell"><router-outlet /></main>
    }
    <ng-template #links
      ><a routerLink="/dashboard" routerLinkActive="active"
        >⌂ <span>Home</span></a
      ><a routerLink="/trends" routerLinkActive="active"
        >⌁ <span>Trends</span></a
      ><a routerLink="/log" routerLinkActive="active">＋ <span>Log</span></a
      ><a routerLink="/badges" routerLinkActive="active"
        >✦ <span>Badges</span></a
      ><a routerLink="/account" routerLinkActive="active"
        >○ <span>Account</span></a
      ></ng-template
    >
    @if (quickOpen()) {
      <div class="dialog-backdrop" (click)="closeQuick()">
        <section
          class="quick-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="$event.stopPropagation()"
        >
          <div class="section-head">
            <h2 id="quick-title">Quick weigh-in</h2>
            <button
              class="icon-button"
              type="button"
              (click)="closeQuick()"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <form [formGroup]="quickForm" (ngSubmit)="saveQuick()">
            <label
              >Weight ({{ display.unitLabel }})<input
                type="number"
                step="0.1"
                min="20"
                max="500"
                formControlName="weightKg" /></label
            ><label
              >Note <small>optional</small
              ><textarea maxlength="280" formControlName="note"></textarea>
            </label>
            @if (quickError()) {
              <p class="field-error" role="alert">{{ quickError() }}</p>
            }
            <button class="button primary" [disabled]="quickForm.invalid">
              Save weigh-in
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
  closeQuick(): void {
    this.quickOpen.set(false);
    queueMicrotask(() => this.quickButton?.nativeElement.focus());
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
        date: new Date().toISOString().slice(0, 10),
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
    path: "onboarding",
    loadComponent: () =>
      import("./feature.pages").then((m) => m.OnboardingPage),
    canActivate: [requireNeedsOnboarding],
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
