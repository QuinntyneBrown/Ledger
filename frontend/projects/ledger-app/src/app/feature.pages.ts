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
import { localCalendarDate } from "./date.utils";

@Component({
  selector: "ledger-welcome",
  standalone: true,
  imports: [RouterLink],
  template: `<section class="welcome-flow">
    <a class="app-rail-brand onboarding-brand" routerLink="/welcome"><span class="app-rail-mark"></span>Ledger</a>
    <div class="welcome-art" aria-hidden="true"><div class="au-gauge welcome-gauge"><svg viewBox="0 0 120 120"><circle class="au-gauge-track" cx="60" cy="60" r="52" stroke-width="9"></circle><circle class="au-gauge-arc welcome-arc" cx="60" cy="60" r="52" stroke-width="9"></circle></svg><div class="au-gauge-center"><svg class="au-icon"><use href="#i-scale" /></svg></div></div></div>
    <div class="welcome-copy"><p class="au-eyebrow">Your honest record</p><h1 class="au-display">Weight,<br />kept honestly.</h1><p class="au-lead">A calm, private place to track progress without judgment or noise.</p></div>
    <a class="au-btn au-btn--primary au-btn--lg" routerLink="/onboarding">Get started <svg class="au-icon"><use href="#i-arrow-right" /></svg></a>
    <p class="au-caption">It takes less than a minute.</p>
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
      <div class="au-field"><label class="au-label" for="profile-height">Height <span class="au-text-lo">optional</span></label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-ruler" /></svg><input id="profile-height" class="au-input" type="number" min="50" max="272" formControlName="heightCm" /><span class="au-input-suffix">cm</span></div></div>
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
          <div class="onb-choice-grid" role="radiogroup" aria-label="Weight unit">
            <label class="onb-choice"><input type="radio" formControlName="unit" value="Kg" /><svg class="au-icon"><use href="#i-scale" /></svg><strong>Kilograms</strong><span class="au-caption">kg</span></label>
            <label class="onb-choice"><input type="radio" formControlName="unit" value="Lbs" /><svg class="au-icon"><use href="#i-scale" /></svg><strong>Pounds</strong><span class="au-caption">lb</span></label>
          </div>
        }
        @case (2) {
          <label class="onb-number"><span class="sr-only">Current weight</span><input type="number" step="0.1" formControlName="currentWeightKg" /><span class="au-bignum-unit">{{ unitLabel() }}</span></label>
        }
        @case (3) {
          <label class="onb-number"><span class="sr-only">Goal weight</span><input type="number" step="0.1" formControlName="goalWeightKg" /><span class="au-bignum-unit">{{ unitLabel() }}</span></label>
        }
        @case (4) {
          <div class="au-card"><label class="au-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Target date</span><input class="au-input" type="date" formControlName="targetDate" /></label></div>
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
      <div class="skeleton hero"></div>
      <div class="stat-grid">
        <i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i>
      </div>
    } @else if (error()) {
      <section class="empty">
        <h2>We couldn’t load your dashboard</h2>
        <p>{{ error() }}</p>
        <button class="button primary" (click)="load()">Try again</button>
      </section>
    } @else if (data(); as d) {
      @if (!d.trend.length) {
        <ledger-empty-state title="Your ledger starts here" message="Log your first weight to begin seeing progress."><a class="au-btn au-btn--primary au-btn--lg au-mt-4" routerLink="/log"><svg class="au-icon"><use href="#i-plus" /></svg>Log weight</a></ledger-empty-state>
      } @else {
      <section class="dash-hero au-rise au-rise-1">
        <div class="dashboard-gauge" [style.--dashboard-progress]="d.progress.percentComplete" role="img" [attr.aria-label]="d.progress.percentComplete + ' percent toward goal, current weight ' + display.fromKg(d.progress.currentWeightKg) + ' ' + display.unitLabel"><span class="au-gauge-caption">CURRENT</span><strong>{{ display.fromKg(d.progress.currentWeightKg) | number: "1.1-1" }}</strong><small>{{ display.unitLabel === 'kg' ? 'kilograms' : 'pounds' }}</small></div>
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
        <div
          class="sparkline"
          role="img"
          [attr.aria-label]="
            'Recent trend containing ' + d.trend.length + ' entries'
          "
        >
          <svg viewBox="0 0 300 80" preserveAspectRatio="none">
            <polyline [attr.points]="points(d)" />
          </svg>
        </div>
      </a>
      <div class="app-section-title"><h2>Next milestone</h2><a routerLink="/badges">All badges</a></div>
      <a class="au-card au-card--interactive next-milestone" routerLink="/badges"><div class="au-ring"><svg class="au-icon"><use href="#i-trophy" /></svg></div><div class="au-fill"><strong>{{ d.nextBadge ? badgeName(d.nextBadge) : "Keep your streak going" }}</strong><div class="au-caption">Every honest entry moves you forward.</div></div><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></a>
      }
      @if (goalCelebration()) { <div class="au-dialog-scrim is-open"><section class="au-dialog celebrate" role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title"><div class="celebrate-medal badge-icon"><svg class="au-icon"><use href="#i-trophy" /></svg></div><p class="au-eyebrow">GOAL REACHED</p><h2 id="goal-celebration-title" class="au-display">You hit your goal!</h2><p class="au-dialog-text">The honest record got you here. Take a moment to celebrate your steady work.</p><button class="au-btn au-btn--primary au-btn--lg" type="button" (click)="goalCelebration.set(false)">See my progress</button></section></div> }
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
  points(d: Dashboard): string {
    return d.trend
      .map(
        (x, i) =>
          `${i * (300 / Math.max(1, d.trend.length - 1))},${70 - (x.weightKg - d.progress.goalWeightKg) * 3}`,
      )
      .join(" ");
  }
  badgeName(value: string): string { return value.replace(/([A-Z])/g, " $1").trim(); }
}

@Component({
  selector: "ledger-log",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `<header class="page-header app-route-header">
      <a class="au-icon-btn" routerLink="/dashboard" aria-label="Back to dashboard"><svg class="au-icon"><use href="#i-arrow-left" /></svg></a>
      <h1 class="app-header-title">Log weight</h1>
      <a class="au-icon-btn" routerLink="/history" aria-label="View history"><svg class="au-icon"><use href="#i-list" /></svg></a>
    </header>
    <section class="weigh-page">
      <div class="weigh-hero"><div class="au-eyebrow">{{ form.controls.date.value === today ? "Today" : "Past entry" }}</div><div class="weigh-date">{{ form.controls.date.value | date: "EEEE, MMM d y":"UTC" }}</div></div>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label class="au-field weigh-date-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Date</span><input class="au-input" type="date" formControlName="date" [max]="today" /></label>
        <label class="weight-input"
          ><span class="sr-only">Weight ({{ display.unitLabel }})</span>
          <div>
            <button
              type="button"
              (click)="adjust(-0.1)"
              aria-label="Decrease weight"
            >
              −</button
            ><input aria-label="Weight"
              type="number"
              step="0.1"
              formControlName="weightKg"
            /><button
              type="button"
              (click)="adjust(0.1)"
              aria-label="Increase weight"
            >
              ＋
            </button>
            <span class="weight-unit">{{ display.unitLabel }}</span>
          </div></label
        ><p class="au-caption weigh-hint">Tap − / + to adjust in 0.1 {{ display.unitLabel }} steps</p>
        <hr class="au-hairline" />
        <label class="au-field"
          ><span class="au-label"><svg class="au-icon"><use href="#i-edit" /></svg>Add a note <small>· optional</small></span
          ><textarea class="au-textarea" maxlength="280" formControlName="note" rows="3" placeholder="e.g. after a morning run, well hydrated"></textarea>
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
        <div class="toast" role="status">
          Weight logged <button (click)="undo()">Undo</button>
        </div>
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
  adjust(n: number): void {
    this.form.controls.weightKg.setValue(
      Math.round((this.form.controls.weightKg.value + n) * 10) / 10,
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
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `<header class="page-header app-route-header">
      <div>
        <p class="app-header-sub">Your record</p>
        <h1 class="app-header-title">History</h1>
      </div>
      <select class="au-select" aria-label="Sort entries" [value]="sort()" (change)="changeSort($event)">
        <option>Newest</option>
        <option>Oldest</option>
        <option>BiggestDrop</option>
      </select>
    </header>
    @if (data(); as d) {
      <p class="muted">{{ d.total }} entries</p>
      @for (month of d.months; track month.year + "-" + month.month) {
        <section class="history-month">
          <h2>
            {{ monthDate(month.year, month.month) | date: "MMMM yyyy":"UTC" }}
            <span
              >{{ display.fromKg(month.netChangeKg) | number: "1.1-1" }}
              {{ display.unitLabel }}</span
            >
          </h2>
          @for (entry of month.entries; track entry.id) {
            <article>
              <div>
                <strong>{{ entry.date | date: "EEE, MMM d":"UTC" }}</strong
                ><small>{{ entry.note }}</small>
              </div>
              <b
                >{{ display.fromKg(entry.weightKg) | number: "1.1-1" }}
                {{ display.unitLabel }}</b
              ><button
                class="au-icon-btn au-icon-btn--sm"
                (click)="beginEdit(entry)"
                aria-label="Edit entry"
              >
                <svg class="au-icon"><use href="#i-edit" /></svg></button
              ><button
                class="au-icon-btn au-icon-btn--sm"
                (click)="requestRemove(entry.id)"
                aria-label="Delete entry"
              >
                <svg class="au-icon"><use href="#i-trash" /></svg></button>
            </article>
            @if (editingId() === entry.id) {
              <form class="inline-editor" (ngSubmit)="saveEdit(entry.id)">
                <label
                  >Weight ({{ display.unitLabel }})<input
                    type="number"
                    step="0.1"
                    name="editWeight"
                    [(ngModel)]="editWeight"
                /></label>
                <label
                  >Note<textarea
                    maxlength="280"
                    name="editNote"
                    [(ngModel)]="editNote"
                  ></textarea>
                </label>
                <div class="actions">
                  <button class="au-btn au-btn--primary">Save</button
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
        </section>
      }
      @if (d.hasMore) {
        <button class="au-btn au-btn--outlined" (click)="more()">Load more</button>
      }
    } @else {
      <ledger-empty-state
        title="No entries yet"
        message="Log your first weight to begin your honest record."
      />
    }
    @if (deletingId()) {
      <div class="au-dialog-scrim is-open" (click)="cancelRemove()"><section class="au-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-entry-title" (click)="$event.stopPropagation()"><div class="au-dialog-icon is-danger"><svg class="au-icon"><use href="#i-trash" /></svg></div><h2 id="delete-entry-title" class="au-dialog-title">Delete this entry?</h2><p class="au-dialog-text">This removes the weigh-in from your history and recalculates your progress.</p><div class="au-dialog-actions"><button class="au-btn au-btn--outlined" type="button" (click)="cancelRemove()">Cancel</button><button class="au-btn au-btn--danger" type="button" (click)="confirmRemove()">Delete entry</button></div></section></div>
    }`,
})
export class HistoryPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<any>(null);
  sort = signal(sessionStorage.getItem("ledger.history.sort") ?? "Newest");
  page = signal(1);
  editingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);
  editWeight = 0;
  editNote = "";
  monthDate(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  constructor() {
    this.load();
  }
  load(append = false): void {
    this.api.history(this.sort(), this.page()).subscribe((x: any) => {
      if (!append || !this.data()) {
        this.data.set(x);
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
    });
  }
  changeSort(e: Event): void {
    this.sort.set((e.target as HTMLSelectElement).value);
    sessionStorage.setItem("ledger.history.sort", this.sort());
    this.page.set(1);
    this.load();
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
    <div class="range-tabs au-segmented" role="tablist" aria-label="Time range">
      @for (r of ranges; track r) {
        <button [class.active]="range() === r" [class.is-active]="range() === r" [attr.aria-selected]="range() === r" (click)="select(r)">
          {{ labels[r] }}
        </button>
      }
    </div>
    @if (data(); as d) {
      @if (d.series.length) {
        <section class="au-card trend-chartcard au-rise au-rise-1">
          <div class="au-row-flex au-between trend-current"><div class="au-stat"><span class="au-stat-label">Current</span><span class="au-stat-value">{{ display.fromKg(d.series[d.series.length - 1].weightKg) | number: "1.1-1" }}<small>{{ display.unitLabel }}</small></span></div><span class="au-chip au-chip--good"><svg class="au-icon"><use href="#i-trending-down" /></svg>{{ display.fromKg(d.totalChangeKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></div>
          <div
            class="chart"
            role="img"
            [attr.aria-label]="d.accessibleDescription"
          >
            <svg viewBox="0 0 600 260" preserveAspectRatio="none">
              <g class="au-chart-grid"><line x1="0" y1="20" x2="600" y2="20"/><line x1="0" y1="80" x2="600" y2="80"/><line x1="0" y1="140" x2="600" y2="140"/><line x1="0" y1="200" x2="600" y2="200"/></g>
              <line
                x1="0"
                [attr.y1]="goalY(d)"
                x2="600"
                [attr.y2]="goalY(d)"
                class="goal-line"
              />
              <polyline [attr.points]="chartPoints(d)" />
            </svg>
          </div>
          <div class="trend-legend"><span><i style="background:var(--viz-2)"></i>Daily weight</span><span><i style="background:var(--brand);height:2px"></i>Goal</span></div>
          <p class="sr-only">{{ d.accessibleDescription }}</p>
        </section>
        <section class="trend-statgrid stat-grid">
          <article class="au-card">
            <span class="au-stat-label">Rate / week</span
            ><strong
              >{{ display.fromKg(d.ratePerWeekKg) | number: "1.2-2" }}
              {{ display.unitLabel }}</strong
            >
          </article>
          <article class="au-card">
            <span class="au-stat-label">Total change</span
            ><strong
              >{{ display.fromKg(d.totalChangeKg) | number: "1.1-1" }}
              {{ display.unitLabel }}</strong
            >
          </article>
          <article class="au-card">
            <span class="au-stat-label">BMI</span><strong>{{ d.bmi ?? "—" }}</strong>
          </article>
        </section>
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
  range = signal("OneMonth");
  data = signal<any>(null);
  constructor() {
    this.load();
  }
  select(r: string): void {
    this.range.set(r);
    this.load();
  }
  load(): void {
    this.api.trends(this.range()).subscribe((x) => this.data.set(x));
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  chartPoints(d: any): string {
    return d.series
      .map(
        (x: any, i: number) =>
          `${i * (600 / Math.max(1, d.series.length - 1))},${220 - (x.weightKg - d.goalWeightKg) * 8}`,
      )
      .join(" ");
  }
  goalY(d: any): number {
    return 220;
  }
}

@Component({
  selector: "ledger-goal",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<header class="page-header app-route-header">
      <a class="au-icon-btn" routerLink="/dashboard" aria-label="Back"><svg class="au-icon"><use href="#i-arrow-left" /></svg></a>
      <h1 class="app-header-title">{{ editing() ? "Edit goal" : "Your goal" }}</h1>
      @if (!editing()) { <button class="au-icon-btn" type="button" aria-label="Edit goal" (click)="editing.set(true)"><svg class="au-icon"><use href="#i-edit" /></svg></button> } @else { <span></span> }
    </header>
    @if (data(); as d) {
      @if (!editing()) {
        <section class="dash-hero goal-hero au-rise au-rise-1">
          <div class="goal-gauge" [style.--goal-progress]="d.percentComplete"><span class="au-gauge-caption">COMPLETE</span><strong>{{ d.percentComplete | number: "1.0-0" }}%</strong><small>{{ display.fromKg(d.remainingKg) | number: "1.1-1" }} {{ display.unitLabel }} to go</small></div>
          <div class="dash-hero-meta"><span class="au-chip"><svg class="au-icon"><use href="#i-flag" /></svg>Start {{ display.fromKg(d.startWeightKg) | number: "1.1-1" }}</span><span class="au-chip"><svg class="au-icon"><use href="#i-scale" /></svg>Now {{ display.fromKg(d.currentWeightKg) | number: "1.1-1" }}</span><span class="au-chip au-chip--brand"><svg class="au-icon"><use href="#i-target" /></svg>Goal {{ display.fromKg(d.goalWeightKg) | number: "1.1-1" }}</span></div>
        </section>
        <section class="au-card goal-progress-card"><div class="au-card-head"><div class="au-card-title"><svg class="au-icon"><use href="#i-activity" /></svg>Progress</div><span class="au-chip au-chip--good">On track</span></div><div class="goal-labels"><span>{{ display.fromKg(d.startWeightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span><span>{{ display.fromKg(d.goalWeightKg) | number: "1.1-1" }} {{ display.unitLabel }}</span></div><div class="au-progress"><div class="au-progress-bar" [style.width.%]="d.percentComplete"></div></div><p class="au-caption">{{ d.pace.message }}</p></section>
        <div class="au-banner au-banner--good goal-pace"><svg class="au-icon"><use href="#i-trending-down" /></svg><div class="au-banner-body"><div class="au-banner-title">Keep your steady pace</div><div class="au-banner-text">{{ d.pace.message }}</div></div></div>
        <button class="au-btn au-btn--tonal au-btn--lg au-btn--block" type="button" (click)="editing.set(true)"><svg class="au-icon"><use href="#i-edit" /></svg>Edit goal</button>
      } @else {
        <section class="au-card goal-editor au-rise au-rise-1">
          <div class="onb-step"><p class="onb-step-num">YOUR DESTINATION</p><h2 class="onb-step-title">Update your goal</h2><p class="onb-step-sub">Choose a weight and date that feel realistic. You can adjust them anytime.</p></div>
          <form class="onb-form" [formGroup]="form" (ngSubmit)="save()">
            <label class="au-field"><span class="au-label">Goal weight ({{ display.unitLabel }})</span><input class="au-input goal-weight-input" type="number" step="0.1" formControlName="goalWeightKg" /></label>
            <label class="au-field"><span class="au-label"><svg class="au-icon"><use href="#i-calendar" /></svg>Target date</span><input class="au-input" type="date" formControlName="targetDate" /></label>
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
  editing = signal(false);
  form = this.fb.nonNullable.group({
    goalWeightKg: [70, Validators.required],
    targetDate: ["", Validators.required],
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.api.goal().subscribe((x: any) => {
      this.data.set(x);
      this.form.patchValue({
        goalWeightKg: this.display.fromKg(x.goalWeightKg),
        targetDate: x.targetDate ?? "",
      });
    });
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
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
}

@Component({
  selector: "ledger-badges",
  standalone: true,
  imports: [CommonModule],
  template: `<header class="page-header app-route-header">
      <div>
        <p class="app-header-sub">Consistency counts</p>
        <h1 class="app-header-title">Milestones</h1>
      </div>
      <span class="au-chip au-chip--brand"><svg class="au-icon"><use href="#i-trophy" /></svg>{{ earned() }} of 8</span>
    </header>
    <section class="au-card mile-streak"><div><p class="au-eyebrow">CURRENT STREAK</p><h2>{{ earned() ? "You’re building momentum" : "Start with one honest entry" }}</h2><p class="au-caption">Consistency matters more than perfection.</p></div><div class="mile-flames" aria-hidden="true">@for (n of [1,2,3,4,5]; track n) { <svg class="au-icon mile-flame" [class.is-off]="n > earned()"><use href="#i-flame" /></svg> }</div></section>
    @if (nextBadge(); as next) { <div class="app-section-title"><h2>Next badge</h2></div><section class="au-card mile-next"><div class="badge-icon"><svg class="au-icon"><use href="#i-award" /></svg></div><div class="au-fill"><strong>{{ name(next.type) }}</strong><p class="au-caption">{{ next.remaining }}</p><div class="au-progress au-mt-3"><div class="au-progress-bar" [style.width.%]="next.progress"></div></div></div></section> }
    <div class="app-section-title"><h2>Your collection</h2></div>
    <section class="badge-grid">
      @for (b of badges(); track b.type) {
        <article [class.locked]="!b.earned">
          <div class="badge-icon" aria-hidden="true"><svg class="au-icon"><use [attr.href]="b.earned ? '#i-award' : '#i-lock'" /></svg></div>
          <h2>{{ name(b.type) }}</h2>
          <p>{{ b.remaining }}</p>
          <div class="mini-progress"><i [style.width.%]="b.progress"></i></div>
          @if (b.celebrationPending) {
            <span class="badge-new">New</span>
          }
        </article>
      }
    </section>
    @if (celebrating(); as badge) { <div class="au-dialog-scrim is-open"><section class="au-dialog celebrate" role="dialog" aria-modal="true" aria-labelledby="badge-title"><div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="celebrate-medal badge-icon"><svg class="au-icon"><use href="#i-trophy" /></svg></div><p class="au-eyebrow">BADGE UNLOCKED</p><h2 id="badge-title" class="au-display">{{ name(badge.type) }}</h2><p class="au-dialog-text">Your consistency earned this. Keep writing the honest record.</p><button class="au-btn au-btn--primary au-btn--lg" type="button" (click)="dismissCelebration()">Keep going <svg class="au-icon"><use href="#i-arrow-right" /></svg></button></section></div> }`,
})
export class BadgesPage {
  private api = inject(LedgerApi);
  badges = signal<any[]>([]);
  celebrating = signal<any | null>(null);
  constructor() {
    this.load();
  }
  earned(): number {
    return this.badges().filter((x) => x.earned).length;
  }
  name(v: string): string {
    return v.replace(/([A-Z])/g, " $1").trim();
  }
  nextBadge(): any | null { return this.badges().find((x) => !x.earned) ?? null; }
  dismissCelebration(): void { const badge = this.celebrating(); if (!badge) return; this.api.acknowledgeMilestone(badge.id).subscribe(() => this.celebrating.set(null)); }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  private load(): void {
    this.api.milestones().subscribe((x: any) => {
      this.badges.set(x);
      this.celebrating.set(x.find((item: any) => item.celebrationPending) ?? null);
    });
  }
}

@Component({
  selector: "ledger-account",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `<header class="page-header app-route-header">
      <div><p class="app-header-sub">Account</p><h1 class="app-header-title">Profile & settings</h1></div>
      <button class="au-icon-btn" type="button" (click)="manage.set(!manage())" [attr.aria-label]="manage() ? 'Close edit forms' : 'Edit profile'"><svg class="au-icon"><use [attr.href]="manage() ? '#i-x' : '#i-edit'" /></svg></button>
    </header>
    <section class="au-card profile-hero au-rise au-rise-1">
      <div class="profile-avatar"><span class="au-avatar au-avatar--lg">{{ profile.controls.name.value.charAt(0).toUpperCase() || "L" }}</span><label class="au-icon-btn profile-camera" aria-label="Change photo"><svg class="au-icon"><use href="#i-camera" /></svg><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" (change)="uploadAvatar($event)" /></label></div>
      <div><h2 class="au-display">{{ profile.controls.name.value || "Ledger member" }}</h2><p class="au-mono au-text-mid">{{ profile.controls.email.value }}</p></div>
      <div class="au-row-flex au-gap-2 au-wrap"><span class="au-chip"><svg class="au-icon"><use href="#i-ruler" /></svg>{{ profile.controls.heightCm.value || "—" }} cm</span><span class="au-chip"><svg class="au-icon"><use href="#i-scale" /></svg>{{ prefs.controls.unit.value }}</span></div>
    </section>
    @if (journey(); as d) { <div class="app-section-title"><h2>Your journey</h2><a routerLink="/trends">Trends</a></div><section class="dash-stats"><article class="au-card dash-ministat"><span class="au-stat-label">Start</span><strong class="au-stat-value">{{ display.fromKg(d.progress.startWeightKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article><article class="au-card dash-ministat"><span class="au-stat-label">Current</span><strong class="au-stat-value brand-value">{{ display.fromKg(d.progress.currentWeightKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article><article class="au-card dash-ministat"><span class="au-stat-label">Goal</span><strong class="au-stat-value">{{ display.fromKg(d.progress.goalWeightKg) | number: "1.1-1" }}</strong><span class="au-caption">{{ display.unitLabel }}</span></article></section> }
    <div class="set-group account-overview"><div class="set-group-title">Preferences</div><div class="au-card au-card--flush">
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-scale" /></svg></span><span class="set-row-main"><span class="set-row-label">Units</span><span class="set-row-desc">Weight display throughout Ledger</span></span><span class="set-row-value">{{ prefs.controls.unit.value }}</span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-moon" /></svg></span><span class="set-row-main"><span class="set-row-label">Appearance</span><span class="set-row-desc">Theme and week layout</span></span><span class="set-row-value">{{ prefs.controls.theme.value }}</span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-bell" /></svg></span><span class="set-row-main"><span class="set-row-label">Daily reminder</span><span class="set-row-desc">Quiet, optional accountability</span></span><span class="set-row-value">{{ reminder.controls.enabled.value ? reminder.controls.time.value : "Off" }}</span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
    </div></div>
    <div class="set-group account-overview"><div class="set-group-title">Account</div><div class="au-card au-card--flush">
      <button class="set-row au-row--interactive overview-row" type="button" (click)="manage.set(true)"><span class="set-row-icon"><svg class="au-icon"><use href="#i-lock" /></svg></span><span class="set-row-main"><span class="set-row-label">Security & profile</span><span class="set-row-desc">Name, email, height and password</span></span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="exportData()"><span class="set-row-icon"><svg class="au-icon"><use href="#i-download" /></svg></span><span class="set-row-main"><span class="set-row-label">Export data</span><span class="set-row-desc">Download all entries as CSV</span></span><svg class="au-icon au-text-lo"><use href="#i-download" /></svg></button>
      <button class="set-row au-row--interactive overview-row" type="button" (click)="signOut()"><span class="set-row-icon"><svg class="au-icon"><use href="#i-logout" /></svg></span><span class="set-row-main"><span class="set-row-label">Sign out</span><span class="set-row-desc">Sign out on this device</span></span><svg class="au-icon au-text-lo"><use href="#i-chevron-right" /></svg></button>
    </div></div>
    @if (manage()) {
    <section class="settings-grid">
      <article class="card">
        <h2>Profile</h2>
        <form [formGroup]="profile" (ngSubmit)="saveProfile()">
          <label
            >Name<input formControlName="name" autocomplete="name"
          /></label>
          <label
            >Email<input
              type="email"
              formControlName="email"
              autocomplete="email"
          /></label>
          <label
            >Height (cm)<input
              type="number"
              formControlName="heightCm"
              min="50"
              max="272"
          /></label>
          <label
            >Profile photo<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              (change)="uploadAvatar($event)"
          /></label>
          <button class="button primary">Save profile</button>
        </form>
      </article>
      <article class="card">
        <h2>Appearance & units</h2>
        <form [formGroup]="prefs" (ngSubmit)="savePrefs()">
          <label
            >Unit<select formControlName="unit">
              <option>Kg</option>
              <option>Lbs</option>
            </select></label
          ><label
            >Theme<select formControlName="theme">
              <option>System</option>
              <option>Dark</option>
              <option>Light</option>
            </select></label
          ><label
            >Week starts<select formControlName="weekStartsOn">
              <option>Monday</option>
              <option>Sunday</option>
            </select></label
          ><button class="button primary">Save preferences</button>
        </form>
      </article>
      <article class="card">
        <h2>Daily reminder</h2>
        <form [formGroup]="reminder" (ngSubmit)="saveReminder()">
          <label class="check"
            ><input type="checkbox" formControlName="enabled" /> Enable
            reminder</label
          ><label>Time<input type="time" formControlName="time" /></label
          ><label class="check"
            ><input type="checkbox" formControlName="quietHoursEnabled" /> Quiet
            hours</label
          >
          <div class="form-row">
            <label
              >From<input
                type="time"
                formControlName="quietHoursStart" /></label
            ><label
              >To<input type="time" formControlName="quietHoursEnd"
            /></label>
          </div>
          <button class="button primary">Save reminder</button>
        </form>
        <button class="button secondary" type="button" (click)="enablePush()">
          Enable browser notifications
        </button>
      </article>
      <article class="card">
        <h2>Security</h2>
        <form [formGroup]="password" (ngSubmit)="changePassword()">
          <label
            >Current password<input
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password"
          /></label>
          <label
            >New password<input
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
          /></label>
          <button class="button primary" [disabled]="password.invalid">
            Change password
          </button>
        </form>
      </article>
      <article class="card">
        <h2>Your data</h2>
        <button class="button secondary" type="button" (click)="exportData()">
          Export CSV
        </button>
        <hr />
        <label
          >Type DELETE to erase tracking data<input
            [(ngModel)]="confirmation"
            [ngModelOptions]="{ standalone: true }" /></label
        ><button
          class="button danger"
          [disabled]="confirmation !== 'DELETE'"
          (click)="erase()"
        >
          Erase tracking data
        </button>
        <button
          class="button danger"
          [disabled]="confirmation !== 'DELETE'"
          (click)="removeAccount()"
        >
          Delete account permanently
        </button>
      </article>
    </section>
    }
    @if (message()) {
      <div class="toast" role="status">{{ message() }}</div>
    }`,
})
export class AccountPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  private router = inject(Router);
  confirmation = "";
  message = signal("");
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
    this.api.dashboard().subscribe((d) => this.journey.set(d));
    this.api.profile().subscribe((p: any) =>
      this.profile.patchValue({
        name: p.name,
        email: p.email,
        heightCm: p.heightCm,
      }),
    );
    this.api.preferences().subscribe((p) => {
      this.prefs.patchValue(p);
      this.reminder.patchValue({
        enabled: p.reminderEnabled,
        time: p.reminderTime.slice(0, 5),
        quietHoursEnabled: p.quietHoursEnabled,
        quietHoursStart: p.quietHoursStart.slice(0, 5),
        quietHoursEnd: p.quietHoursEnd.slice(0, 5),
      });
    });
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
