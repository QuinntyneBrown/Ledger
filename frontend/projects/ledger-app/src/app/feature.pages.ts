import { CommonModule, DatePipe, DecimalPipe } from "@angular/common";
import { Component, HostListener, inject, signal } from "@angular/core";
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { DisplayPreferencesService, LedgerApi } from "@ledger/api";
import { Dashboard, Preferences } from "@ledger/domain";
import { EmptyStateComponent } from "@ledger/components";
import { forkJoin } from "rxjs";
import { localCalendarDate } from "./date.utils";

@Component({
  selector: "ledger-welcome",
  standalone: true,
  imports: [RouterLink],
  template: `<section class="welcome-flow">
    <div class="welcome-brand au-row-flex au-gap-3"><span class="auth-mark"></span><span class="au-display">Ledger</span></div>
    <div class="welcome-hero"><div class="welcome-art" aria-hidden="true"><div class="au-gauge welcome-gauge"><svg viewBox="0 0 120 120"><circle class="au-gauge-track" cx="60" cy="60" r="52" stroke-width="7"></circle><circle class="au-gauge-arc" cx="60" cy="60" r="52" stroke-width="7" stroke-dasharray="326.73" stroke-dashoffset="91.5"></circle></svg><div class="au-gauge-center"><span class="auth-mark welcome-center-mark"></span></div></div></div>
    <div class="welcome-copy"><p class="au-eyebrow"><svg class="au-icon"><use href="#i-sparkles" /></svg>Your private weight ledger</p><h1 class="au-display">Weight,<br />kept honestly.</h1><p class="au-lead">Log in seconds, watch the trend settle, and reach your goal — one honest entry at a time.</p></div></div>
    <div class="welcome-actions"><a class="au-btn au-btn--primary au-btn--lg au-btn--block" routerLink="/onboarding">Get started <svg class="au-icon"><use href="#i-arrow-right" /></svg></a><p class="au-caption">It takes less than a minute.</p></div>
  </section>`,
})
export class WelcomePage {}

@Component({
  selector: "ledger-profile-setup",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="wizard wizard-shell">
    <div class="wizard-top"><span class="app-rail-brand onboarding-brand"><span class="app-rail-mark"></span>Ledger</span><button class="au-btn au-btn--text au-btn--sm" type="button" (click)="skip()">Skip</button></div>
    <div class="onb-progress" aria-label="Profile setup"><i class="is-done"></i><i class="is-done"></i><i class="is-done"></i><i class="is-done"></i></div>
    <div class="onb-step"><p class="onb-step-num">FINAL STEP</p><h1 class="onb-step-title">Set up your profile</h1><p class="onb-step-sub">A few details make your trends more useful. You can change these anytime.</p></div>
    <form class="onb-form" [formGroup]="form" (ngSubmit)="save()">
      <div class="profile-avatar"><span class="au-avatar au-avatar--lg">{{ initial() }}</span><label class="au-icon-btn profile-camera" aria-label="Choose profile photo"><svg class="au-icon"><use href="#i-camera" /></svg><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($event)" /></label></div>
      <div class="au-field"><label class="au-label" for="profile-name">Your name</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-user" /></svg><input id="profile-name" class="au-input" formControlName="name" autocomplete="name" /></div></div>
      <div class="au-field"><label class="au-label" for="profile-height">Height <span class="au-text-lo">optional</span></label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-ruler" /></svg><input id="profile-height" class="au-input" type="number" min="50" max="272" formControlName="heightCm" /><span class="au-input-affix">cm</span></div></div>
      @if (error()) { <p class="au-help is-error" role="alert">{{ error() }}</p> }
      <div class="actions"><button class="au-btn au-btn--text au-btn--lg" type="button" (click)="skip()">Skip for now</button><button class="au-btn au-btn--primary au-btn--lg">Finish setup <svg class="au-icon"><use href="#i-check" /></svg></button></div>
    </form>
  </section>`,
})
export class ProfileSetupPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private router = inject(Router);
  error = signal("");
  form = this.fb.nonNullable.group({ name: ["", Validators.required], heightCm: [null as number | null] });
  constructor() { this.api.profile().subscribe((p: any) => this.form.patchValue({ name: p.name, heightCm: p.heightCm })); }
  initial(): string { return this.form.controls.name.value.trim().charAt(0).toUpperCase() || "L"; }
  upload(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) this.api.uploadAvatar(file).subscribe({ error: (e) => this.error.set(this.api.problem(e)) }); }
  save(): void { if (this.form.invalid) return; this.api.profile().subscribe((p: any) => this.api.updateProfile({ ...p, ...this.form.getRawValue() }).subscribe({ next: () => this.skip(), error: (e) => this.error.set(this.api.problem(e)) })); }
  skip(): void { void this.router.navigateByUrl("/dashboard"); }
}

@Component({
  selector: "ledger-onboarding",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="wizard wizard-shell">
    <div class="wizard-top">
      <span class="app-rail-brand onboarding-brand"><span class="app-rail-mark"></span>Ledger</span>
      <button class="au-btn au-btn--text au-btn--sm" type="button" (click)="signOut()"><svg class="au-icon"><use href="#i-logout" /></svg>Sign out</button>
    </div>
    <div class="onb-progress" aria-label="Step {{ step() }} of 4">
      @for (n of [1,2,3,4]; track n) { <i [class.is-done]="n <= step()"></i> }
    </div>
    <div class="onb-step">
      <p class="onb-step-num">STEP {{ step() }} OF 4</p>
      <h1 class="onb-step-title">{{ stepTitle() }}</h1>
      <p class="onb-step-sub">{{ stepSubtitle() }}</p>
    </div>
    <form class="onb-form" [formGroup]="form" (ngSubmit)="next()">
      @switch (step()) {
        @case (1) {
          <div class="au-row-flex" style="justify-content:center;margin:var(--space-6) 0"><div class="au-segmented" role="radiogroup" aria-label="Weight unit"><button type="button" role="radio" [class.is-active]="form.controls.unit.value === 'Kg'" [class.is-brand]="form.controls.unit.value === 'Kg'" [attr.aria-checked]="form.controls.unit.value === 'Kg'" (click)="form.controls.unit.setValue('Kg')">Kilograms</button><button type="button" role="radio" [class.is-active]="form.controls.unit.value === 'Lbs'" [class.is-brand]="form.controls.unit.value === 'Lbs'" [attr.aria-checked]="form.controls.unit.value === 'Lbs'" (click)="form.controls.unit.setValue('Lbs')">Pounds</button></div></div>
        }
        @case (2) {
          <div class="au-card au-card--pad-lg"><div class="weigh-stepper"><button class="weigh-stepper-btn" type="button" (click)="adjustOnboarding('currentWeightKg', -0.1)" aria-label="Decrease"><svg class="au-icon"><use href="#i-minus" /></svg></button><label class="au-bignum-field"><span class="sr-only">Current weight</span><input class="au-bignum" type="text" inputmode="decimal" formControlName="currentWeightKg" /><span class="au-bignum-unit">{{ unitLabel() }}</span></label><button class="weigh-stepper-btn" type="button" (click)="adjustOnboarding('currentWeightKg', 0.1)" aria-label="Increase"><svg class="au-icon"><use href="#i-plus" /></svg></button></div><p class="au-caption au-mt-2" style="text-align:center">Tap to adjust in 0.1 {{ unitLabel() }} steps</p></div>
        }
        @case (3) {
          <div class="au-card au-card--pad-lg"><div class="weigh-stepper"><button class="weigh-stepper-btn" type="button" (click)="adjustOnboarding('goalWeightKg', -0.1)" aria-label="Decrease"><svg class="au-icon"><use href="#i-minus" /></svg></button><label class="au-bignum-field"><span class="sr-only">Goal weight</span><input class="au-bignum" type="text" inputmode="decimal" formControlName="goalWeightKg" /><span class="au-bignum-unit">{{ unitLabel() }}</span></label><button class="weigh-stepper-btn" type="button" (click)="adjustOnboarding('goalWeightKg', 0.1)" aria-label="Increase"><svg class="au-icon"><use href="#i-plus" /></svg></button></div><p class="au-caption au-mt-2" style="text-align:center">Tap to adjust in 0.1 {{ unitLabel() }} steps</p></div>
        }
        @case (4) {
          <div class="au-card"><label class="au-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Target date</span><div class="au-input-wrap"><input class="au-input" type="date" formControlName="targetDate" /></div></label></div>
        }
      }
      @if (error()) {
        <div class="au-banner au-banner--bad" role="alert"><svg class="au-icon"><use href="#i-alert-circle" /></svg><div class="au-banner-body"><div class="au-banner-title">We couldn’t save that</div><div class="au-banner-text">{{ error() }}</div></div></div>
      }
      <div class="actions">
        @if (step() > 1) {
          <button type="button" class="au-btn au-btn--text au-btn--lg" (click)="step.set(step() - 1)"><svg class="au-icon"><use href="#i-arrow-left" /></svg>Back</button>
        }
        <button class="au-btn au-btn--primary au-btn--lg">
          {{ step() === 4 ? "Finish setup" : "Continue" }}
          <svg class="au-icon"><use href="#i-arrow-right" /></svg>
        </button>
      </div>
    </form>
  </section>`,
})
export class OnboardingPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private router = inject(Router);
  step = signal(1);
  error = signal("");
  form = this.fb.nonNullable.group({
    unit: ["Kg", Validators.required],
    currentWeightKg: [
      80,
      [Validators.required, Validators.min(20), Validators.max(1102)],
    ],
    goalWeightKg: [
      70,
      [Validators.required, Validators.min(20), Validators.max(1102)],
    ],
    targetDate: ["", Validators.required],
  });
  constructor() {
    let previousUnit = this.form.controls.unit.value;
    this.form.controls.unit.valueChanges.subscribe((unit) => {
      if (unit === previousUnit) return;
      const factor = unit === "Lbs" ? 2.2046226218 : 1 / 2.2046226218;
      for (const control of [
        this.form.controls.currentWeightKg,
        this.form.controls.goalWeightKg,
      ])
        control.setValue(Math.round(control.value * factor * 10) / 10, {
          emitEvent: false,
        });
      previousUnit = unit;
    });
    this.api.onboarding().subscribe(({ draft }: any) => {
      if (!draft) return;
      this.step.set(Math.min(4, (draft.lastCompletedStep ?? 0) + 1));
      this.form.patchValue({
        unit: draft.unit ?? "Kg",
        currentWeightKg: this.fromKg(draft.currentWeightKg ?? 80, draft.unit),
        goalWeightKg: this.fromKg(draft.goalWeightKg ?? 70, draft.unit),
        targetDate: draft.targetDate ?? "",
      });
      });
  }
  signOut(): void {
    this.api.signOut().subscribe(() => this.router.navigateByUrl("/sign-in"));
  }
  next(): void {
    this.error.set("");
    if (this.step() < 4) {
      const value = this.form.getRawValue();
      this.api
        .saveOnboarding({
          lastCompletedStep: this.step(),
          unit: value.unit,
          currentWeightKg:
            this.step() >= 2 ? this.toKg(value.currentWeightKg) : null,
          goalWeightKg:
            this.step() >= 3 ? this.toKg(value.goalWeightKg) : null,
          targetDate: value.targetDate || null,
        })
        .subscribe({
          next: () => this.step.update((x) => x + 1),
          error: (e) => this.error.set(this.api.problem(e)),
        });
      return;
    }
    const v = this.form.getRawValue();
    this.api
      .completeOnboarding({
        ...v,
        currentWeightKg: this.toKg(v.currentWeightKg),
        goalWeightKg: this.toKg(v.goalWeightKg),
        targetDate: v.targetDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .subscribe({
        next: () => this.router.navigateByUrl("/onboarding/profile"),
        error: (e) => this.error.set(this.api.problem(e)),
      });
  }
  unitLabel(): string {
    return this.form.controls.unit.value === "Lbs" ? "lb" : "kg";
  }
  adjustOnboarding(controlName: "currentWeightKg" | "goalWeightKg", amount: number): void {
    const control = this.form.controls[controlName];
    control.setValue(Math.round((Number(control.value) + amount) * 10) / 10);
  }
  stepTitle(): string {
    return ["", "How do you measure?", "What do you weigh now?", "What’s your goal weight?", "When would you like to get there?"][this.step()];
  }
  stepSubtitle(): string {
    return ["", "Choose the unit you use every day.", "This becomes the honest starting point for your ledger.", "A clear destination makes every entry meaningful.", "Choose a realistic date. You can change it later."][this.step()];
  }
  private toKg(value: number): number {
    return this.form.controls.unit.value === "Lbs"
      ? Math.round((value / 2.2046226218) * 10) / 10
      : Math.round(value * 10) / 10;
  }
  private fromKg(value: number, unit: string): number {
    return unit === "Lbs" ? Math.round(value * 2.2046226218 * 10) / 10 : value;
  }
}

@Component({
  selector: "ledger-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <div class="au-row-flex au-gap-3"><span class="au-avatar au-avatar--sm">L</span><div><p class="app-header-sub">{{ today | date: "EEEE, MMM d" }}</p><h1 class="app-header-title">{{ data()?.greeting ?? "Your ledger" }}</h1></div></div>
      <a class="au-icon-btn" routerLink="/account" aria-label="Settings"><svg class="au-icon"><use href="#i-settings" /></svg></a>
    </header>
    @if (loading()) {
      <div class="au-skeleton" style="height:360px"></div>
      <div class="dash-stats au-mt-6">
        <i class="au-skeleton" style="height:96px"></i><i class="au-skeleton" style="height:96px"></i><i class="au-skeleton" style="height:96px"></i>
      </div>
    } @else if (error()) {
      <ledger-empty-state title="We couldn’t load your dashboard" [message]="error()"><button class="au-btn au-btn--primary au-btn--lg au-mt-4" (click)="load()">Try again</button></ledger-empty-state>
    } @else if (data(); as d) {
      @if (!d.trend.length) {
        <ledger-empty-state title="Your ledger starts here" message="Log your first weight to begin seeing progress."><a class="au-btn au-btn--primary au-btn--lg au-mt-4" routerLink="/log"><svg class="au-icon"><use href="#i-plus" /></svg>Log weight</a></ledger-empty-state>
      } @else {
      <section class="dash-hero au-rise au-rise-1">
        <div class="au-gauge dashboard-gauge" role="img" [attr.aria-label]="d.progress.percentComplete + ' percent toward goal, current weight ' + display.fromKg(d.progress.currentWeightKg) + ' ' + display.unitLabel"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="au-gauge-track" cx="60" cy="60" r="52" stroke-width="9"></circle><circle class="au-gauge-arc" cx="60" cy="60" r="52" stroke-width="9" stroke-dasharray="326.73" [attr.stroke-dashoffset]="gaugeOffset(d.progress.percentComplete)"></circle></svg><div class="au-gauge-center"><span class="au-gauge-caption">CURRENT</span><strong class="au-gauge-value">{{ display.fromKg(d.progress.currentWeightKg) | number: "1.1-1" }}</strong><span class="au-gauge-unit">{{ display.unitLabel === 'kg' ? 'kilograms' : 'pounds' }}</span></div></div>
        <div class="dash-hero-meta">
          <span class="au-chip"><svg class="au-icon"><use href="#i-flag" /></svg>Start <b>{{ display.fromKg(d.progress.startWeightKg) | number: "1.1-1" }}</b></span>
          <span class="au-chip au-chip--brand"><svg class="au-icon"><use href="#i-target" /></svg>Goal <b>{{ display.fromKg(d.progress.goalWeightKg) | number: "1.1-1" }}</b></span>
        </div>
        <p class="au-caption pace"><strong>{{ d.progress.percentComplete | number: "1.0-0" }}% there</strong> — {{ d.progress.pace.message }}</p>
      </section>
      <section class="dash-stats au-rise au-rise-2">
        <article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">This week</span><strong class="au-stat-value au-delta is-good">{{ display.fromKg(d.thisWeekChangeKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article>
        <article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">Avg / week</span><strong class="au-stat-value">{{ display.fromKg(d.averageWeeklyChangeKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article>
        <article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">Streak</span><strong class="au-stat-value streak-value">{{ d.currentStreak }}</strong><span class="au-caption">days</span></article>
      </section>
      <div class="app-section-title"><h2>Last 30 days</h2><a routerLink="/trends">View trends</a></div>
      <a class="au-card au-card--interactive trend-snapshot" routerLink="/trends">
        <div class="au-row-flex au-between"><div class="au-stat"><span class="au-stat-label">30-day direction</span><span class="au-delta is-good"><svg class="au-icon"><use href="#i-trending-down" /></svg>{{ display.fromKg(d.thisWeekChangeKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></div><span class="au-chip au-chip--good">On track</span></div>
        <svg
          class="au-sparkline"
          role="img"
          [attr.aria-label]="
            'Recent trend containing ' + d.trend.length + ' entries'
          "
          viewBox="0 0 300 44" preserveAspectRatio="none"><path [attr.d]="sparkPath(d)" /></svg>
      </a>
      <div class="app-section-title"><h2>Next milestone</h2><a routerLink="/badges">All badges</a></div>
      <a class="au-card au-card--interactive next-milestone" routerLink="/badges"><div class="au-ring" [style.--_pct]="d.progress.percentComplete"><span>{{ d.progress.percentComplete | number: "1.0-0" }}%</span></div><div class="au-fill"><strong>{{ d.nextBadge ? badgeName(d.nextBadge) : "Keep your streak going" }}</strong><div class="au-caption">Every honest entry moves you forward.</div></div><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></a>
      }
      @if (goalCelebration()) { <div class="au-scrim is-open"><section class="au-dialog celebrate" role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title"><div class="celebrate-medal au-medal"><svg class="au-icon"><use href="#i-trophy" /></svg></div><p class="au-eyebrow">GOAL REACHED</p><h2 id="goal-celebration-title" class="au-display">You hit your goal!</h2><p class="au-dialog-body">The honest record got you here. Take a moment to celebrate your steady work.</p><button class="au-btn au-btn--primary au-btn--lg" type="button" (click)="goalCelebration.set(false)">See my progress</button></section></div> }
    } `,
})
export class DashboardPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<Dashboard | null>(null);
  loading = signal(true);
  error = signal("");
  goalCelebration = signal(false);
  today = new Date();
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.api.dashboard().subscribe({
      next: (x) => {
        this.data.set(x);
        this.goalCelebration.set(x.progress.reached);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.api.problem(e));
        this.loading.set(false);
      },
    });
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  gaugeOffset(percent: number): number {
    return 326.73 * (1 - Math.max(0, Math.min(100, percent)) / 100);
  }
  sparkPath(d: Dashboard): string {
    const values = d.trend.map((x) => x.weightKg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.1, max - min);
    return values.map((value, i) => `${i ? "L" : "M"}${i * (300 / Math.max(1, values.length - 1))},${6 + ((max - value) / span) * 32}`).join(" ");
  }
  badgeName(value: string): string { return value.replace(/([A-Z])/g, " $1").trim(); }
}

@Component({
  selector: "ledger-log",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  template: `<header class="page-header app-route-header">
      <a class="au-icon-btn" routerLink="/dashboard" aria-label="Back to dashboard"><svg class="au-icon"><use href="#i-arrow-left" /></svg></a>
      <h1 class="app-header-title">Log weight</h1>
      <button class="au-icon-btn" type="button" (click)="chooseDate.set(!chooseDate())" aria-label="Choose date"><svg class="au-icon"><use href="#i-calendar" /></svg></button>
    </header>
    <section class="weigh-page">
      <div class="weigh-hero"><div class="au-eyebrow">{{ form.controls.date.value === today ? "Today" : "Past entry" }}</div><div class="weigh-date">{{ form.controls.date.value | date: "EEEE, MMM d y":"UTC" }}</div></div>
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (chooseDate()) { <label class="au-field weigh-date-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Date</span><div class="au-input-wrap"><input class="au-input" type="date" formControlName="date" [max]="today" /></div></label> }
        <div class="weigh-stepper">
          <button class="weigh-stepper-btn" type="button" (click)="adjust(-0.1)" aria-label="Decrease by 0.1"><svg class="au-icon"><use href="#i-minus" /></svg></button>
          <label class="au-bignum-field"><span class="sr-only">Weight ({{ display.unitLabel }})</span><input class="au-bignum" aria-label="Weight" type="text" inputmode="decimal" formControlName="weightKg" /><span class="au-bignum-unit">{{ display.unitLabel }}</span></label>
          <button class="weigh-stepper-btn" type="button" (click)="adjust(0.1)" aria-label="Increase by 0.1"><svg class="au-icon"><use href="#i-plus" /></svg></button>
        </div>
        @if (dashboard(); as d) { <div class="au-row-flex au-gap-2 au-wrap" style="justify-content:center"><span class="au-chip au-chip--good"><svg class="au-icon"><use href="#i-trending-down" /></svg>{{ display.fromKg(d.thisWeekChangeKg) | number: "1.1-1" }} this week</span><span class="au-chip"><svg class="au-icon"><use href="#i-target" /></svg>{{ display.fromKg(d.progress.remainingKg) | number: "1.1-1" }} to goal</span></div> }
        <p class="au-caption weigh-hint">Tap − / + to adjust in 0.1 {{ display.unitLabel }} steps</p>
        <hr class="au-hairline" />
        <label class="au-field"
          ><span class="au-label"><svg class="au-icon"><use href="#i-edit" /></svg>Add a note <small>· optional</small></span
          ><div class="au-input-wrap"><input class="au-input" maxlength="280" formControlName="note" placeholder="e.g. after a morning run, well hydrated" /></div>
        </label>
        @if (error()) {
          <p class="au-help is-error" role="alert">{{ error() }}</p>
        }
        <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid || busy()">
          <svg class="au-icon"><use href="#i-check" /></svg>{{ busy() ? "Saving…" : "Save weight" }}
        </button>
        <p class="au-caption weigh-hint">Logged entries sync to your trends automatically</p>
      </form>
      @if (saved()) {
        <div class="au-toast-region app-toast-region"><div class="au-toast au-toast--success" role="status"><svg class="au-icon au-toast-icon"><use href="#i-check-circle" /></svg><span class="au-toast-msg">Weight logged</span><button class="au-toast-action" type="button" (click)="undo()">Undo</button></div></div>
      }
    </section>`,
})
export class LogPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  today = localCalendarDate();
  form = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    weightKg: [
      75,
      [Validators.required, Validators.min(20), Validators.max(1102)],
    ],
    note: [""],
  });
  error = signal("");
  busy = signal(false);
  saved = signal<any>(null);
  chooseDate = signal(false);
  dashboard = signal<Dashboard | null>(null);
  constructor() {
    this.api.dashboard().subscribe((d) => {
      this.dashboard.set(d);
      if (this.form.pristine) this.form.controls.weightKg.setValue(this.display.fromKg(d.progress.currentWeightKg));
    });
  }
  adjust(n: number): void {
    this.form.controls.weightKg.setValue(
      Math.round((Number(this.form.controls.weightKg.value) + n) * 10) / 10,
    );
  }
  save(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    const value = this.form.getRawValue();
    this.api
      .logWeight({ ...value, weightKg: this.display.toKg(value.weightKg) })
      .subscribe({
        next: (x) => {
          this.saved.set(x);
          this.busy.set(false);
        },
        error: (e) => {
          this.error.set(this.api.problem(e));
          this.busy.set(false);
        },
      });
  }
  undo(): void {
    const r = this.saved();
    if (!r) return;
    if (r.created)
      this.api.deleteWeight(r.entry.id).subscribe(() => this.saved.set(null));
    else
      this.api
        .editWeight(r.entry.id, {
          weightKg: r.previous.weightKg,
          note: r.previous.note,
        })
        .subscribe(() => this.saved.set(null));
  }
}

@Component({
  selector: "ledger-history",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <div class="au-row-flex au-gap-2"><a class="au-icon-btn au-icon-btn--sm" routerLink="/trends" aria-label="Back"><svg class="au-icon"><use href="#i-chevron-left" /></svg></a><div><p class="app-header-sub">{{ data()?.total ?? 0 }} entries</p><h1 class="app-header-title">History</h1></div></div>
      <button class="au-icon-btn" type="button" (click)="filterOpen.set(true)" aria-label="Filter and sort"><svg class="au-icon"><use href="#i-filter" /></svg></button>
    </header>
    @if (loading()) {
      <div class="au-skeleton" style="height:52px"></div><div class="au-skeleton au-mt-4" style="height:420px"></div>
    } @else if (error()) {
      <ledger-empty-state title="We couldn’t load your history" [message]="error()"><button class="au-btn au-btn--primary au-mt-4" type="button" (click)="load()">Try again</button></ledger-empty-state>
    } @else if (data(); as d) {
      @if (d.total) {
      <div class="au-banner au-banner--info history-hint"><svg class="au-icon"><use href="#i-info" /></svg><div class="au-banner-body"><span class="au-banner-text">Tap a day to edit its weight or note</span></div></div>
      @for (month of d.months; track month.year + "-" + month.month) {
        <section class="history-month">
          <h2 class="history-month-title">
            {{ monthDate(month.year, month.month) | date: "MMMM yyyy":"UTC" }}
            <span
              >{{ display.fromKg(month.netChangeKg) | number: "1.1-1" }}
              {{ display.unitLabel }}</span
            >
          </h2>
          <div class="au-card au-card--flush au-list">
          @for (entry of month.entries; track entry.id; let entryIndex = $index) {
            <button class="au-row au-row--interactive history-row" type="button" (click)="beginEdit(entry)">
              <span class="sr-only">{{ entry.date | date: "EEE, MMM d":"UTC" }}</span>
              <time class="au-row-date">{{ entry.date | date: "MMM d":"UTC" }}</time>
              <span class="au-row-main history-entry-main"><strong class="au-row-primary">{{ display.fromKg(entry.weightKg) | number: "1.1-1" }} {{ display.unitLabel }}</strong><small class="au-row-secondary">{{ entry.note || (entry.date | date: "EEEE":"UTC") }}</small></span>
              <span class="au-chip history-delta" [class.au-chip--good]="entryDelta(month.entries, entryIndex) < 0" [class.history-delta-bad]="entryDelta(month.entries, entryIndex) > 0">{{ display.fromKg(entryDelta(month.entries, entryIndex)) | number: "1.1-1" }}</span>
              <svg class="au-icon au-text-lo history-more"><use href="#i-more-horizontal" /></svg>
            </button>
            @if (editingId() === entry.id) {
              <form class="inline-editor" (ngSubmit)="saveEdit(entry.id)">
                <label class="au-field"><span class="au-label">Weight ({{ display.unitLabel }})</span><div class="au-input-wrap"><input class="au-input" type="number" step="0.1" name="editWeight" [(ngModel)]="editWeight" /></div></label>
                <label class="au-field"><span class="au-label">Note</span><div class="au-input-wrap"><textarea class="au-input" maxlength="280" name="editNote" [(ngModel)]="editNote"></textarea></div></label>
                <div class="actions">
                  <button type="button" class="au-btn au-btn--danger" (click)="requestRemove(entry.id)"><svg class="au-icon"><use href="#i-trash" /></svg>Delete</button><button class="au-btn au-btn--primary">Save</button
                  ><button
                    type="button"
                    class="au-btn au-btn--outlined"
                    (click)="editingId.set(null)"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            }
          }
          </div>
        </section>
      }
      @if (d.hasMore) {
        <div class="history-load"><button class="au-btn au-btn--outlined" (click)="more()">Load more</button></div>
      }
      } @else {
      <ledger-empty-state
        title="No entries yet"
        message="Log your first weight to begin your honest record."
      />
      }
    }
    @if (filterOpen()) { <div class="au-sheet-scrim" (click)="filterOpen.set(false)"><section class="au-sheet" role="dialog" aria-modal="true" aria-labelledby="history-sort-title" (click)="$event.stopPropagation()"><div class="au-sheet-grip"></div><div class="au-row-flex au-between"><h2 id="history-sort-title">Sort history</h2><button class="au-icon-btn" type="button" (click)="filterOpen.set(false)" aria-label="Close"><svg class="au-icon"><use href="#i-x" /></svg></button></div><div class="au-stack au-stack-4 au-mt-4">@for (option of sortOptions; track option.value) { <label class="au-check au-check--radio"><input type="radio" name="history-sort" [checked]="sort() === option.value" (change)="setSort(option.value)" /><span class="au-box"><span class="au-dot"></span></span>{{ option.label }}</label> }</div></section></div> }
    @if (deletingId()) {
      <div class="au-scrim is-open" (click)="cancelRemove()"><section class="au-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-entry-title" (click)="$event.stopPropagation()"><div class="au-dialog-icon is-danger"><svg class="au-icon"><use href="#i-trash" /></svg></div><h2 id="delete-entry-title" class="au-dialog-title">Delete this entry?</h2><p class="au-dialog-body">This removes the weigh-in from your history and recalculates your progress.</p><div class="au-dialog-actions"><button class="au-btn au-btn--outlined" type="button" (click)="cancelRemove()">Cancel</button><button class="au-btn au-btn--danger" type="button" (click)="confirmRemove()">Delete entry</button></div></section></div>
    }`,
})
export class HistoryPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<any>(null);
  loading = signal(true);
  error = signal("");
  sort = signal(sessionStorage.getItem("ledger.history.sort") ?? "Newest");
  page = signal(1);
  editingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);
  filterOpen = signal(false);
  sortOptions = [{ value: "Newest", label: "Newest first" }, { value: "Oldest", label: "Oldest first" }, { value: "BiggestDrop", label: "Biggest drop" }];
  editWeight = 0;
  editNote = "";
  monthDate(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  constructor() {
    this.load();
  }
  load(append = false): void {
    if (!append) this.loading.set(true);
    this.error.set("");
    this.api.history(this.sort(), this.page()).subscribe({ next: (x: any) => {
      if (!append || !this.data()) {
        this.data.set(x);
        this.loading.set(false);
        return;
      }
      const existing = this.data();
      const groups = new Map<string, any>();
      for (const month of [...existing.months, ...x.months]) {
        const key = `${month.year}-${month.month}`;
        const current = groups.get(key);
        if (!current)
          groups.set(key, { ...month, entries: [...month.entries] });
        else current.entries.push(...month.entries);
      }
      for (const month of groups.values()) {
        const chronological = [...month.entries].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        month.netChangeKg =
          chronological.length < 2
            ? 0
            : chronological.at(-1).weightKg - chronological[0].weightKg;
      }
      this.data.set({ ...x, months: [...groups.values()] });
      this.loading.set(false);
    }, error: (e) => { this.error.set(this.api.problem(e)); this.loading.set(false); } });
  }
  changeSort(e: Event): void {
    this.setSort((e.target as HTMLSelectElement).value);
  }
  setSort(value: string): void {
    this.sort.set(value);
    sessionStorage.setItem("ledger.history.sort", this.sort());
    this.page.set(1);
    this.load();
    this.filterOpen.set(false);
  }
  entryDelta(entries: any[], index: number): number {
    const current = entries[index];
    const previous = entries
      .filter((entry) => entry.date < current.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return previous ? current.weightKg - previous.weightKg : 0;
  }
  more(): void {
    this.page.update((x) => x + 1);
    this.load(true);
  }
  requestRemove(id: string): void { this.deletingId.set(id); }
  cancelRemove(): void { this.deletingId.set(null); }
  confirmRemove(): void {
    const id = this.deletingId();
    if (!id) return;
    this.api.deleteWeight(id).subscribe(() => {
      this.deletingId.set(null);
      this.page.set(1);
      this.load();
    });
  }
  beginEdit(entry: any): void {
    this.editingId.set(entry.id);
    this.editWeight = this.display.fromKg(entry.weightKg);
    this.editNote = entry.note ?? "";
  }
  saveEdit(id: string): void {
    this.api
      .editWeight(id, {
        weightKg: this.display.toKg(this.editWeight),
        note: this.editNote,
      })
      .subscribe(() => {
        this.editingId.set(null);
        this.page.set(1);
        this.load();
      });
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
}

@Component({
  selector: "ledger-trends",
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <div>
        <p class="app-header-sub">Analytics</p>
        <h1 class="app-header-title">Trends</h1>
      </div>
      <a class="au-icon-btn" routerLink="/history" aria-label="View history"><svg class="au-icon"><use href="#i-list" /></svg></a>
    </header>
    @if (loading()) { <div class="au-skeleton" style="height:520px"></div><div class="trend-statgrid"><i class="au-skeleton" style="height:92px"></i><i class="au-skeleton" style="height:92px"></i><i class="au-skeleton" style="height:92px"></i><i class="au-skeleton" style="height:92px"></i></div> } @else if (error()) { <ledger-empty-state title="We couldn’t load your trends" [message]="error()"><button class="au-btn au-btn--primary au-mt-4" type="button" (click)="load()">Try again</button></ledger-empty-state> } @else if (data(); as d) {
      @if (d.series.length) {
        <section class="au-card trend-chartcard au-rise au-rise-1">
          <div class="au-row-flex au-between trend-current"><div class="au-stat"><span class="au-stat-label">Current</span><span class="au-stat-value">{{ display.fromKg(d.series[d.series.length - 1].weightKg) | number: "1.1-1" }}<small>{{ display.unitLabel }}</small></span></div><span class="au-chip au-chip--good"><svg class="au-icon"><use href="#i-trending-down" /></svg>{{ display.fromKg(d.totalChangeKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></div>
          <div class="trend-range"><div class="au-segmented" role="tablist" aria-label="Time range">@for (r of ranges; track r) { <button type="button" [class.is-active]="range() === r" [attr.aria-selected]="range() === r" (click)="select(r)">{{ labels[r] }}</button> }</div></div>
          <div class="au-chart trend-chart"><svg viewBox="0 0 640 240" preserveAspectRatio="none" role="img" [attr.aria-label]="d.accessibleDescription">
            <g class="au-chart-grid"><line x1="40" y1="20" x2="620" y2="20"/><line x1="40" y1="70" x2="620" y2="70"/><line x1="40" y1="120" x2="620" y2="120"/><line x1="40" y1="170" x2="620" y2="170"/><line x1="40" y1="220" x2="620" y2="220"/></g>
            <path class="au-chart-band" [attr.d]="bandPath(d)"/>
            <line class="au-chart-goal" x1="40" [attr.y1]="goalY(d)" x2="620" [attr.y2]="goalY(d)"/>
            <path class="au-chart-area" [attr.d]="areaPath(d)"/>
            <path class="au-chart-line au-chart-line--ma" [attr.d]="movingAveragePath(d)"/>
            <path class="au-chart-line" [attr.d]="chartPath(d)"/>
            <text x="612" [attr.y]="goalY(d) - 6" text-anchor="end" class="au-chart-axis">Goal {{ display.fromKg(d.goalWeightKg) | number: "1.1-1" }}</text>
            <circle [attr.cx]="chartX(d.series.length - 1, d.series.length)" [attr.cy]="chartY(d, d.series[d.series.length - 1].weightKg)" r="5" class="au-chart-dot"/>
          </svg></div>
          <div class="trend-legend"><span><i style="background:var(--viz-2)"></i>Daily</span><span><i style="background:var(--viz-1)"></i>7-day avg</span><span><i style="background:var(--viz-band)"></i>Range</span><span><i style="background:var(--brand);height:2px"></i>Goal</span></div>
          <p class="sr-only">{{ d.accessibleDescription }}</p>
        </section>
        <section class="trend-statgrid au-rise au-rise-2">
          <article class="au-card au-card--pad-sm"><span class="au-stat-label">Rate / week</span><strong class="au-stat-value au-delta is-good">{{ display.fromKg(d.ratePerWeekKg) | number: "1.2-2" }}<small>{{ display.unitLabel }}</small></strong></article>
          <article class="au-card au-card--pad-sm"><span class="au-stat-label">Total lost</span><strong class="au-stat-value au-delta is-good">{{ display.fromKg(d.totalChangeKg) | number: "1.1-1" }}<small>{{ display.unitLabel }}</small></strong></article>
          <article class="au-card au-card--pad-sm"><span class="au-stat-label">Best week</span><strong class="au-stat-value au-delta is-good">{{ display.fromKg(d.bestWeekKg) | number: "1.1-1" }}<small>{{ display.unitLabel }}</small></strong></article>
          <article class="au-card au-card--pad-sm"><span class="au-stat-label">BMI</span><strong class="au-stat-value">{{ d.bmi ?? "—" }}</strong></article>
        </section>
        <div class="app-section-title"><h2>Recent entries</h2><a routerLink="/history">View all</a></div>
        <section class="au-card au-card--pad-sm au-rise au-rise-3"><div class="au-list">@for (entry of recent(d); track entry.id; let i = $index) { <a class="au-row au-row--interactive" routerLink="/history"><time class="au-row-date">{{ entry.date | date: "MMM d":"UTC" }}</time><span class="au-row-main"><span class="au-row-primary">{{ display.fromKg(entry.weightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></span>@if (recentDelta(d, i); as delta) { <span class="au-delta" [class.is-good]="delta < 0" [class.is-bad]="delta > 0">{{ display.fromKg(delta) | number: "1.1-1" }}</span> }<svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></a> }</div></section>
      } @else {
        <ledger-empty-state
          title="Keep logging"
          message="A useful trend needs at least two entries over time."
        />
      }
    }`,
})
export class TrendsPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  ranges = [
    "OneWeek",
    "OneMonth",
    "ThreeMonths",
    "SixMonths",
    "OneYear",
    "All",
  ];
  labels: Record<string, string> = {
    OneWeek: "1W",
    OneMonth: "1M",
    ThreeMonths: "3M",
    SixMonths: "6M",
    OneYear: "1Y",
    All: "All",
  };
  range = signal("ThreeMonths");
  data = signal<any>(null);
  loading = signal(true);
  error = signal("");
  constructor() {
    this.load();
  }
  select(r: string): void {
    this.range.set(r);
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set("");
    this.api.trends(this.range()).subscribe({ next: (x) => { this.data.set(x); this.loading.set(false); }, error: (e) => { this.error.set(this.api.problem(e)); this.loading.set(false); } });
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  chartX(index: number, count: number): number { return 40 + index * (572 / Math.max(1, count - 1)); }
  chartY(d: any, weight: number): number {
    const values = [...d.series.flatMap((x: any) => [x.weightKg, x.lowKg ?? x.weightKg, x.highKg ?? x.weightKg]), d.goalWeightKg];
    const min = Math.min(...values), max = Math.max(...values), pad = Math.max(.5, (max - min) * .12);
    return 20 + ((max + pad - weight) / Math.max(1, max - min + pad * 2)) * 200;
  }
  chartPath(d: any): string { return d.series.map((x: any, i: number) => `${i ? "L" : "M"}${this.chartX(i,d.series.length)},${this.chartY(d,x.weightKg)}`).join(" "); }
  areaPath(d: any): string { return `${this.chartPath(d)} L612,220 L40,220 Z`; }
  movingAveragePath(d: any): string {
    return d.series.map((point: any, i: number) => `${i ? "L" : "M"}${this.chartX(i,d.series.length)},${this.chartY(d,point.movingAverageKg)}`).join(" ");
  }
  bandPath(d: any): string {
    const top = d.series.map((point:any,i:number)=>`${i?"L":"M"}${this.chartX(i,d.series.length)},${this.chartY(d,point.highKg)}`).join(" ");
    const bottom = d.series.map((point:any,i:number)=>({point,i})).reverse().map((item:any)=>`L${this.chartX(item.i,d.series.length)},${this.chartY(d,item.point.lowKg)}`).join(" ");
    return `${top} ${bottom} Z`;
  }
  goalY(d: any): number { return this.chartY(d, d.goalWeightKg); }
  recent(d: any): any[] { return (d.recentEntries?.length ? d.recentEntries : d.series.slice().reverse()).slice(0, 3); }
  recentDelta(d: any, reversedIndex: number): number {
    const entries = this.recent(d);
    return entries[reversedIndex + 1] ? entries[reversedIndex].weightKg - entries[reversedIndex + 1].weightKg : 0;
  }
}

@Component({
  selector: "ledger-goal",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <a class="au-icon-btn" routerLink="/dashboard" aria-label="Back"><svg class="au-icon"><use href="#i-arrow-left" /></svg></a>
      <h1 class="app-header-title">{{ editing() ? "Edit goal" : "Your goal" }}</h1>
      @if (!editing()) { <button class="au-icon-btn" type="button" aria-label="Edit goal" (click)="editing.set(true)"><svg class="au-icon"><use href="#i-edit" /></svg></button> } @else { <span></span> }
    </header>
    @if (loading()) { <div class="au-skeleton" style="height:280px"></div><div class="au-skeleton au-mt-6" style="height:220px"></div> } @else if (loadError()) { <ledger-empty-state title="We couldn’t load your goal" [message]="loadError()"><button class="au-btn au-btn--primary au-mt-4" type="button" (click)="load()">Try again</button></ledger-empty-state> } @else if (data(); as d) {
      @if (!editing()) {
        <section class="dash-hero goal-hero au-rise au-rise-1">
          <div class="au-gauge goal-gauge" role="img" [attr.aria-label]="d.percentComplete + ' percent of the way to your goal'"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="au-gauge-track" cx="60" cy="60" r="52" stroke-width="9"></circle><circle class="au-gauge-arc" cx="60" cy="60" r="52" stroke-width="9" stroke-dasharray="326.73" [attr.stroke-dashoffset]="gaugeOffset(d.percentComplete)"></circle></svg><div class="au-gauge-center"><span class="au-gauge-caption">COMPLETE</span><strong class="au-gauge-value">{{ d.percentComplete | number: "1.0-0" }}%</strong><span class="au-gauge-unit">{{ display.fromKg(d.remainingKg) | number: "1.1-1" }} {{ display.unitLabel }} to go</span></div></div>
          <div class="dash-hero-meta"><span class="au-chip"><svg class="au-icon"><use href="#i-flag" /></svg>Start {{ display.fromKg(d.startWeightKg) | number: "1.1-1" }}</span><span class="au-chip"><svg class="au-icon"><use href="#i-scale" /></svg>Now {{ display.fromKg(d.currentWeightKg) | number: "1.1-1" }}</span><span class="au-chip au-chip--brand"><svg class="au-icon"><use href="#i-target" /></svg>Goal {{ display.fromKg(d.goalWeightKg) | number: "1.1-1" }}</span></div>
        </section>
        <section class="au-card goal-progress-card"><div class="au-card-head"><div class="au-card-title"><svg class="au-icon"><use href="#i-activity" /></svg>Progress</div><span class="au-chip au-chip--good">On track</span></div><div class="goal-labels"><span>{{ display.fromKg(d.startWeightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span><span>{{ display.fromKg(d.goalWeightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></div><div class="au-progress"><div class="au-progress-bar" [style.width.%]="d.percentComplete"></div></div><p class="au-caption">{{ d.pace.message }}</p></section>
        <section class="dash-stats au-rise au-rise-3 au-mt-4"><article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">Target</span><strong class="au-stat-value au-mono">{{ d.targetDate | date: "MMM d":"UTC" }}</strong><span class="au-caption">{{ d.targetDate | date: "y":"UTC" }}</span></article><article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">Rate</span><strong class="au-stat-value au-delta is-good">{{ display.fromKg(d.pace.weeklyRateKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }} / week</span></article><article class="au-card dash-ministat au-card--pad-sm"><span class="au-stat-label">Left</span><strong class="au-stat-value">{{ display.fromKg(d.remainingKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article></section>
        <div class="au-banner au-banner--good goal-pace"><svg class="au-icon"><use href="#i-trending-down" /></svg><div class="au-banner-body"><div class="au-banner-title">Keep your steady pace</div><div class="au-banner-text">{{ d.pace.message }}</div></div></div>
        <button class="au-btn au-btn--tonal au-btn--lg au-btn--block" type="button" (click)="editing.set(true)"><svg class="au-icon"><use href="#i-edit" /></svg>Edit goal</button>
      } @else {
        <section class="au-card goal-editor au-rise au-rise-1">
          <div class="onb-step"><p class="onb-step-num">YOUR DESTINATION</p><h2 class="onb-step-title">Update your goal</h2><p class="onb-step-sub">Choose a weight and date that feel realistic. You can adjust them anytime.</p></div>
          <form class="onb-form" [formGroup]="form" (ngSubmit)="save()">
            <label class="au-field"><span class="au-label">Goal weight ({{ display.unitLabel }})</span><div class="au-input-wrap"><input class="au-input goal-weight-input" type="number" step="0.1" formControlName="goalWeightKg" /><span class="au-input-affix">{{ display.unitLabel }}</span></div></label>
            <label class="au-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Target date</span><div class="au-input-wrap"><input class="au-input" type="date" formControlName="targetDate" /></div></label>
            @if (message()) { <p class="au-help" role="status">{{ message() }}</p> }
            <div class="actions"><button type="button" class="au-btn au-btn--text" (click)="editing.set(false)">Cancel</button><button class="au-btn au-btn--primary au-btn--lg">Save goal</button></div>
          </form>
        </section>
      }
    }`,
})
export class GoalPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<any>(null);
  message = signal("");
  loading = signal(true);
  loadError = signal("");
  editing = signal(false);
  form = this.fb.nonNullable.group({
    goalWeightKg: [70, Validators.required],
    targetDate: ["", Validators.required],
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.loadError.set("");
    this.api.goal().subscribe({ next: (x: any) => {
      this.data.set(x);
      this.form.patchValue({
        goalWeightKg: this.display.fromKg(x.goalWeightKg),
        targetDate: x.targetDate ?? "",
      });
      this.loading.set(false);
    }, error: (e) => { this.loadError.set(this.api.problem(e)); this.loading.set(false); } });
  }
  save(): void {
    const value = this.form.getRawValue();
    this.api
      .setGoal({
        ...value,
        goalWeightKg: this.display.toKg(value.goalWeightKg),
      })
      .subscribe({
        next: () => {
          this.message.set("Goal updated");
          this.editing.set(false);
          this.load();
        },
        error: (e) => this.message.set(this.api.problem(e)),
      });
  }
  gaugeOffset(percent: number): number {
    return 326.73 * (1 - Math.max(0, Math.min(100, percent)) / 100);
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
}

@Component({
  selector: "ledger-badges",
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <div>
        <p class="app-header-sub">Consistency counts</p>
        <h1 class="app-header-title">Milestones</h1>
      </div>
      <span class="au-chip au-chip--brand"><svg class="au-icon"><use href="#i-trophy" /></svg>{{ earned() }} of 8</span>
    </header>
    @if (loading()) {
      <section class="au-card mile-streak"><div class="au-skeleton au-skeleton--circle" style="width:52px;height:52px"></div><div class="au-fill"><div class="au-skeleton au-skeleton--line" style="width:35%"></div><div class="au-skeleton au-skeleton--line" style="width:80%"></div></div></section>
      <section class="mile-grid">@for (slot of [1,2,3,4]; track slot) { <article class="au-badge-tile"><div class="au-skeleton au-skeleton--circle" style="width:64px;height:64px"></div><div class="au-skeleton au-skeleton--line" style="width:70%"></div><div class="au-skeleton au-skeleton--line" style="width:45%"></div></article> }</section>
    } @else if (error()) {
      <ledger-empty-state icon="alert-circle" title="Milestones unavailable" [message]="error()" actionLabel="Try again" (action)="load()" />
    } @else {
    <section class="au-card mile-streak au-rise au-rise-1"><div class="au-medal" style="width:52px;height:52px;flex:none"><svg class="au-icon au-icon--fill"><use href="#i-flame" /></svg></div><div class="au-fill"><div class="au-row-flex au-gap-2" style="align-items:baseline"><strong class="au-display" style="font-size:var(--text-3xl);color:var(--warn)">{{ dashboard()?.currentStreak ?? 0 }}</strong><span class="au-caption">day streak</span></div><div class="mile-flames" aria-hidden="true">@for (n of flameSlots; track n) { <span class="mile-flame" [class.is-off]="n > (dashboard()?.currentStreak ?? 0)"><svg class="au-icon au-icon--fill"><use href="#i-flame" /></svg></span> }</div></div></section>
    @if (nextBadge(); as next) { <div class="app-section-title"><h2>Next badge</h2></div><section class="au-card mile-next au-rise au-rise-2"><div class="au-ring" [style.--_pct]="next.progress"><span>{{ next.progress | number: "1.0-0" }}%</span></div><div class="au-fill"><strong>{{ name(next.type) }}</strong><p class="au-caption">{{ next.remaining }}</p><div class="au-progress au-progress--brand au-mt-2"><div class="au-progress-bar" [style.width.%]="next.progress"></div></div></div></section> }
    <div class="app-section-title"><h2>Your collection</h2></div>
    <section class="mile-grid au-rise au-rise-3">
      @for (b of badges(); track b.type) {
        <article class="au-badge-tile" [class.is-locked]="!b.earned">
          @if (b.earned) { <span class="badge-earned-tick"><svg class="au-icon"><use href="#i-check-circle" /></svg></span> } @else { <span class="badge-lock-tick"><svg class="au-icon"><use href="#i-lock" /></svg></span> }
          <div class="au-medal" [class.au-medal--good]="badgeTone(b.type) === 'good'" [class.au-medal--violet]="badgeTone(b.type) === 'violet'" aria-hidden="true"><svg class="au-icon" [class.au-icon--fill]="badgeIcon(b.type) === '#i-flame'"><use [attr.href]="badgeIcon(b.type)" /></svg></div>
          <h2 class="au-badge-name">{{ name(b.type) }}</h2><p class="au-badge-desc">{{ b.earned ? "Earned" : b.remaining }}</p>
        </article>
      }
    </section>
    @if (celebrating(); as badge) { <div class="au-scrim is-open"><section class="au-dialog celebrate" role="dialog" aria-modal="true" aria-labelledby="badge-title"><div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="celebrate-medal au-medal"><svg class="au-icon"><use href="#i-trophy" /></svg></div><p class="au-eyebrow">BADGE UNLOCKED</p><h2 id="badge-title" class="au-display">{{ name(badge.type) }}</h2><p class="au-dialog-body">Your consistency earned this. Keep writing the honest record.</p><button class="au-btn au-btn--primary au-btn--lg" type="button" (click)="dismissCelebration()">Keep going <svg class="au-icon"><use href="#i-arrow-right" /></svg></button></section></div> }
    }`,
})
export class BadgesPage {
  private api = inject(LedgerApi);
  badges = signal<any[]>([]);
  dashboard = signal<Dashboard | null>(null);
  celebrating = signal<any | null>(null);
  loading = signal(true);
  error = signal("");
  flameSlots = Array.from({ length: 14 }, (_, i) => i + 1);
  constructor() {
    this.load();
    const dashboardRequest = (this.api as any).dashboard?.();
    dashboardRequest?.subscribe((d: Dashboard) => this.dashboard.set(d));
  }
  earned(): number {
    return this.badges().filter((x) => x.earned).length;
  }
  name(v: string): string {
    return v.replace(/([A-Z])/g, " $1").trim();
  }
  nextBadge(): any | null { return this.badges().find((x) => !x.earned) ?? null; }
  badgeIcon(type: string): string {
    const value = type.toLowerCase();
    if (value.includes("streak")) return "#i-flame";
    if (value.includes("entry")) return "#i-flag";
    if (value.includes("goal")) return "#i-target";
    if (value.includes("weight") || value.includes("kg")) return "#i-trending-down";
    return "#i-award";
  }
  badgeTone(type: string): "good" | "violet" | "gold" {
    const value = type.toLowerCase();
    return value.includes("streak") ? "violet" : value.includes("weight") || value.includes("kg") ? "good" : "gold";
  }
  dismissCelebration(): void { const badge = this.celebrating(); if (!badge) return; this.api.acknowledgeMilestone(badge.id).subscribe(() => this.celebrating.set(null)); }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set("");
    this.api.milestones().subscribe({
      next: (x: any) => {
        this.badges.set(x);
        this.celebrating.set(x.find((item: any) => item.celebrationPending) ?? null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.api.problem(e));
        this.loading.set(false);
      },
    });
  }
}

@Component({
  selector: "ledger-account",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <h1 class="app-header-title">Profile</h1>
      <button class="au-btn au-btn--text au-btn--sm" type="button" (click)="manage.set(!manage())" [attr.aria-label]="manage() ? 'Close edit forms' : 'Edit profile'"><svg class="au-icon"><use [attr.href]="manage() ? '#i-x' : '#i-edit'" /></svg>{{ manage() ? "Close" : "Edit" }}</button>
    </header>
    @if (loading()) { <div class="au-skeleton" style="height:256px"></div><div class="au-skeleton au-mt-6" style="height:360px"></div> } @else if (error()) { <ledger-empty-state title="We couldn’t load your profile" [message]="error()"><button class="au-btn au-btn--primary au-mt-4" type="button" (click)="load()">Try again</button></ledger-empty-state> } @else {
    <section class="au-card profile-hero au-rise au-rise-1">
      <div class="profile-avatar"><span class="au-avatar au-avatar--lg">{{ profile.controls.name.value.charAt(0).toUpperCase() || "L" }}</span><label class="au-icon-btn profile-camera" aria-label="Change photo"><svg class="au-icon"><use href="#i-camera" /></svg><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" (change)="uploadAvatar($event)" /></label></div>
      <div><h2 class="au-display">{{ profile.controls.name.value || "Ledger member" }}</h2><p class="au-mono au-text-mid">{{ profile.controls.email.value }}</p></div>
      <div class="au-row-flex au-gap-2 au-wrap"><span class="au-chip"><svg class="au-icon"><use href="#i-ruler" /></svg>{{ profile.controls.heightCm.value || "—" }} cm</span><span class="au-chip"><svg class="au-icon"><use href="#i-scale" /></svg>{{ prefs.controls.unit.value }}</span></div>
    </section>
    @if (journey(); as d) { <div class="app-section-title"><h2>Your journey</h2><a routerLink="/trends">Trends</a></div><section class="dash-stats"><article class="au-card dash-ministat"><span class="au-stat-label">Start</span><strong class="au-stat-value">{{ display.fromKg(d.progress.startWeightKg) | number: "1.0-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article><article class="au-card dash-ministat"><span class="au-stat-label">Current</span><strong class="au-stat-value brand-value">{{ display.fromKg(d.progress.currentWeightKg) | number: "1.0-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article><article class="au-card dash-ministat"><span class="au-stat-label">Goal</span><strong class="au-stat-value">{{ display.fromKg(d.progress.goalWeightKg) | number: "1.0-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article></section><div class="au-card au-card--pad-sm journey-summary"><span class="au-chip au-chip--good"><svg class="au-icon"><use href="#i-trending-down" /></svg>{{ display.fromKg(d.progress.currentWeightKg - d.progress.startWeightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span><span class="au-caption">{{ d.progress.percentComplete | number: "1.0-0" }}% of the way to your goal — {{ display.fromKg(d.progress.remainingKg) | number: "1.1-1" }} {{ display.unitLabel }} to go.</span></div> }
    <div class="set-group account-overview"><div class="set-group-title">Account details</div><div class="au-card au-card--flush">
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-user" /></svg></span><span class="set-row-main"><span class="set-row-desc">Name</span><span class="set-row-label">{{ profile.controls.name.value }}</span></span><svg class="au-icon au-text-lo"><use href="#i-edit" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-mail" /></svg></span><span class="set-row-main"><span class="set-row-desc">Email</span><span class="set-row-label">{{ profile.controls.email.value }}</span></span><svg class="au-icon au-text-lo"><use href="#i-edit" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-ruler" /></svg></span><span class="set-row-main"><span class="set-row-desc">Height</span><span class="set-row-label">{{ profile.controls.heightCm.value || "—" }} cm</span></span><svg class="au-icon au-text-lo"><use href="#i-edit" /></svg></button>
    </div></div>
    <div class="set-group account-overview"><div class="set-group-title">Security</div><div class="au-card au-card--flush">
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-lock" /></svg></span><span class="set-row-main"><span class="set-row-label">Change password</span><span class="set-row-desc">Keep your account secure</span></span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="signOut()"><span class="set-row-icon"><svg class="au-icon"><use href="#i-logout" /></svg></span><span class="set-row-main"><span class="set-row-label">Sign out</span><span class="set-row-desc">Sign out on this device</span></span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
    </div></div>
    <div class="set-group account-overview"><div class="set-group-title">Preferences & data</div><div class="au-card au-card--flush"><button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-settings" /></svg></span><span class="set-row-main"><span class="set-row-label">Preferences</span><span class="set-row-desc">Units, appearance and reminders</span></span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button><button class="set-row au-row--interactive overview-row" type="button" (click)="exportData()"><span class="set-row-icon"><svg class="au-icon"><use href="#i-download" /></svg></span><span class="set-row-main"><span class="set-row-label">Export data</span><span class="set-row-desc">Download all entries as CSV</span></span><svg class="au-icon au-text-lo"><use href="#i-download" /></svg></button></div></div>
    @if (manage()) {
    <section class="settings-grid">
      <article class="au-card">
        <h2 class="au-card-title"><svg class="au-icon"><use href="#i-user" /></svg>Profile</h2>
        <form [formGroup]="profile" (ngSubmit)="saveProfile()">
          <label class="au-field"><span class="au-label">Name</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-user" /></svg><input class="au-input" formControlName="name" autocomplete="name" /></div></label>
          <label class="au-field"><span class="au-label">Email</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-mail" /></svg><input class="au-input" type="email" formControlName="email" autocomplete="email" /></div></label>
          <label class="au-field"><span class="au-label">Height</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-ruler" /></svg><input class="au-input" type="number" formControlName="heightCm" min="50" max="272" /><span class="au-input-affix">cm</span></div></label>
          <label class="au-field"><span class="au-label">Profile photo</span><div class="au-input-wrap"><input class="au-input" type="file" accept="image/jpeg,image/png,image/webp" (change)="uploadAvatar($event)" /></div></label>
          <button class="au-btn au-btn--primary au-btn--lg">Save profile</button>
        </form>
      </article>
      <article class="au-card">
        <h2 class="au-card-title"><svg class="au-icon"><use href="#i-moon" /></svg>Appearance & units</h2>
        <form [formGroup]="prefs" (ngSubmit)="savePrefs()">
          <label class="au-field"><span class="au-label">Unit</span><div class="au-select-wrap"><select class="au-select" formControlName="unit"><option>Kg</option><option>Lbs</option></select><svg class="au-icon"><use href="#i-chevron-down" /></svg></div></label>
          <label class="au-field"><span class="au-label">Theme</span><div class="au-select-wrap"><select class="au-select" formControlName="theme"><option>System</option><option>Dark</option><option>Light</option></select><svg class="au-icon"><use href="#i-chevron-down" /></svg></div></label>
          <label class="au-field"><span class="au-label">Week starts</span><div class="au-select-wrap"><select class="au-select" formControlName="weekStartsOn"><option>Monday</option><option>Sunday</option></select><svg class="au-icon"><use href="#i-chevron-down" /></svg></div></label>
          <button class="au-btn au-btn--primary au-btn--lg">Save preferences</button>
        </form>
      </article>
      <article class="au-card">
        <h2 class="au-card-title"><svg class="au-icon"><use href="#i-bell" /></svg>Daily reminder</h2>
        <form [formGroup]="reminder" (ngSubmit)="saveReminder()">
          <div class="au-row-flex au-between"><span><strong>Enable reminder</strong><span class="au-caption" style="display:block">A quiet daily prompt</span></span><label class="au-switch"><input type="checkbox" formControlName="enabled" /><span class="au-switch-track"></span><span class="au-switch-thumb"></span></label></div>
          <label class="au-field"><span class="au-label">Time</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-clock" /></svg><input class="au-input" type="time" formControlName="time" /></div></label>
          <div class="au-row-flex au-between"><span><strong>Quiet hours</strong><span class="au-caption" style="display:block">Pause reminders overnight</span></span><label class="au-switch"><input type="checkbox" formControlName="quietHoursEnabled" /><span class="au-switch-track"></span><span class="au-switch-thumb"></span></label></div>
          <div class="form-row">
            <label class="au-field"><span class="au-label">From</span><div class="au-input-wrap"><input class="au-input" type="time" formControlName="quietHoursStart" /></div></label><label class="au-field"><span class="au-label">To</span><div class="au-input-wrap"><input class="au-input" type="time" formControlName="quietHoursEnd" /></div></label>
          </div>
          <button class="au-btn au-btn--primary au-btn--lg">Save reminder</button>
        </form>
        <button class="au-btn au-btn--outlined" type="button" (click)="enablePush()"><svg class="au-icon"><use href="#i-bell" /></svg>Enable browser notifications</button>
      </article>
      <article class="au-card">
        <h2 class="au-card-title"><svg class="au-icon"><use href="#i-lock" /></svg>Security</h2>
        <form [formGroup]="password" (ngSubmit)="changePassword()">
          <label class="au-field"><span class="au-label">Current password</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input class="au-input" type="password" formControlName="currentPassword" autocomplete="current-password" /></div></label>
          <label class="au-field"><span class="au-label">New password</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input class="au-input" type="password" formControlName="newPassword" autocomplete="new-password" /></div><span class="au-help">At least 8 characters.</span></label>
          <button class="au-btn au-btn--primary au-btn--lg" [disabled]="password.invalid">Change password</button>
        </form>
      </article>
      <article class="au-card danger-zone">
        <h2 class="au-card-title"><svg class="au-icon"><use href="#i-download" /></svg>Your data</h2>
        <button class="au-btn au-btn--outlined" type="button" (click)="exportData()"><svg class="au-icon"><use href="#i-download" /></svg>Export CSV</button>
        <hr class="au-hairline" />
        <label class="au-field"><span class="au-label">Type DELETE to confirm destructive actions</span><div class="au-input-wrap"><svg class="au-icon"><use href="#i-alert-triangle" /></svg><input class="au-input" [(ngModel)]="confirmation" [ngModelOptions]="{ standalone: true }" /></div></label>
        <button class="au-btn au-btn--danger" [disabled]="confirmation !== 'DELETE'" (click)="erase()"><svg class="au-icon"><use href="#i-trash" /></svg>Erase tracking data</button>
        <button class="au-btn au-btn--danger" [disabled]="confirmation !== 'DELETE'" (click)="removeAccount()"><svg class="au-icon"><use href="#i-trash" /></svg>Delete account permanently</button>
      </article>
    </section>
    }
    @if (message()) {
      <div class="au-toast-region app-toast-region"><div class="au-toast au-toast--success" role="status"><svg class="au-icon au-toast-icon"><use href="#i-check-circle" /></svg><span class="au-toast-msg">{{ message() }}</span></div></div>
    }
    }`,
})
export class AccountPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  private router = inject(Router);
  confirmation = "";
  message = signal("");
  loading = signal(true);
  error = signal("");
  manage = signal(false);
  journey = signal<Dashboard | null>(null);
  profile = this.fb.nonNullable.group({
    name: ["", Validators.required],
    email: ["", [Validators.required, Validators.email]],
    heightCm: [null as number | null],
  });
  password = this.fb.nonNullable.group({
    currentPassword: ["", Validators.required],
    newPassword: ["", [Validators.required, Validators.minLength(8)]],
  });
  prefs = this.fb.nonNullable.group({
    unit: ["Kg"],
    theme: ["System"],
    weekStartsOn: ["Monday"],
  });
  reminder = this.fb.nonNullable.group({
    enabled: [false],
    time: ["08:00"],
    quietHoursEnabled: [false],
    quietHoursStart: ["22:00"],
    quietHoursEnd: ["07:00"],
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set("");
    forkJoin({ journey: this.api.dashboard(), profile: this.api.profile(), preferences: this.api.preferences() }).subscribe({ next: ({ journey, profile: p, preferences }) => {
      const profile = p as { name: string; email: string; heightCm: number | null };
      this.journey.set(journey);
      this.profile.patchValue({
        name: profile.name,
        email: profile.email,
        heightCm: profile.heightCm,
      });
      this.prefs.patchValue(preferences);
      this.reminder.patchValue({
        enabled: preferences.reminderEnabled,
        time: preferences.reminderTime.slice(0, 5),
        quietHoursEnabled: preferences.quietHoursEnabled,
        quietHoursStart: preferences.quietHoursStart.slice(0, 5),
        quietHoursEnd: preferences.quietHoursEnd.slice(0, 5),
      });
      this.loading.set(false);
    }, error: (e) => { this.error.set(this.api.problem(e)); this.loading.set(false); } });
  }
  saveProfile(): void {
    this.api
      .updateProfile(this.profile.getRawValue())
      .subscribe(() => this.message.set("Profile saved"));
  }
  uploadAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api
      .uploadAvatar(file)
      .subscribe(() => this.message.set("Profile photo updated"));
  }
  changePassword(): void {
    const value = this.password.getRawValue();
    this.api
      .changePassword(value.currentPassword, value.newPassword)
      .subscribe({
        next: () => {
          this.message.set("Password changed");
          this.password.reset();
        },
        error: (e) => this.message.set(this.api.problem(e)),
      });
  }
  enablePush(): void {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      this.message.set("Browser notifications are not supported here");
      return;
    }
    this.api.pushPublicKey().subscribe(async ({ publicKey }) => {
      if (!publicKey) {
        this.message.set(
          "Notifications need VAPID keys configured on the server",
        );
        return;
      }
      const registration =
        await navigator.serviceWorker.register("/push-sw.js");
      const bytes = Uint8Array.from(
        atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      const json = subscription.toJSON();
      this.api
        .savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.["p256dh"],
          auth: json.keys?.["auth"],
        })
        .subscribe(() => this.message.set("Browser notifications enabled"));
    });
  }
  savePrefs(): void {
    const value = this.prefs.getRawValue() as Partial<Preferences>;
    this.api
      .updatePreferences({
        ...value,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .subscribe((p) => {
        this.display.apply(p);
        this.message.set("Preferences saved");
      });
  }
  saveReminder(): void {
    const v = this.reminder.getRawValue();
    this.api
      .scheduleReminder({
        ...v,
        time: v.time + ":00",
        quietHoursStart: v.quietHoursStart + ":00",
        quietHoursEnd: v.quietHoursEnd + ":00",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .subscribe(() => this.message.set("Reminder saved"));
  }
  erase(): void {
    this.api.deleteData(this.confirmation).subscribe(() => {
      this.message.set("Tracking data erased");
      this.router.navigateByUrl("/onboarding");
    });
  }
  exportData(): void {
    this.api.exportData().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ledger-export.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }
  removeAccount(): void {
    this.api.deleteAccount(this.confirmation).subscribe(() => {
      this.message.set("Account deleted");
      this.router.navigateByUrl("/sign-in");
    });
  }
  signOut(): void {
    this.api.signOut().subscribe(() => this.router.navigateByUrl("/sign-in"));
  }
}
