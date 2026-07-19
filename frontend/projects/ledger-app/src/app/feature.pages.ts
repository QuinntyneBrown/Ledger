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
import { EmptyStateComponent, ProgressRingComponent } from "@ledger/components";

@Component({
  selector: "ledger-onboarding",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="wizard">
    <div class="section-head">
      <p class="eyebrow">Step {{ step() }} of 4</p>
      <button class="button secondary" type="button" (click)="signOut()">
        Sign out
      </button>
    </div>
    <div class="step-track"><i [style.width.%]="step() * 25"></i></div>
    <h1>Set your baseline</h1>
    <form [formGroup]="form" (ngSubmit)="next()">
      @switch (step()) {
        @case (1) {
          <fieldset>
            <legend>How do you measure?</legend>
            <label class="choice"
              ><input type="radio" formControlName="unit" value="Kg" />
              Kilograms</label
            ><label class="choice"
              ><input type="radio" formControlName="unit" value="Lbs" />
              Pounds</label
            >
          </fieldset>
        }
        @case (2) {
          <label
            >Current weight<input
              type="number"
              step="0.1"
              formControlName="currentWeightKg"
            /><span>{{ unitLabel() }}</span></label
          >
        }
        @case (3) {
          <label
            >Goal weight<input
              type="number"
              step="0.1"
              formControlName="goalWeightKg"
            /><span>{{ unitLabel() }}</span></label
          >
        }
        @case (4) {
          <label
            >Target date<input type="date" formControlName="targetDate"
          /></label>
        }
      }
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        @if (step() > 1) {
          <button
            type="button"
            class="button secondary"
            (click)="step.set(step() - 1)"
          >
            Back
          </button>
        }
        <button class="button primary">
          {{ step() === 4 ? "Finish setup" : "Continue" }}
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
    if (this.step() < 4) {
      const value = this.form.getRawValue();
      this.api
        .saveOnboarding({
          lastCompletedStep: this.step(),
          ...value,
          currentWeightKg: this.toKg(value.currentWeightKg),
          goalWeightKg: this.toKg(value.goalWeightKg),
        })
        .subscribe(() => this.step.update((x) => x + 1));
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
        next: () => this.router.navigateByUrl("/dashboard"),
        error: (e) => this.error.set(this.api.problem(e)),
      });
  }
  unitLabel(): string {
    return this.form.controls.unit.value === "Lbs" ? "lb" : "kg";
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
  imports: [CommonModule, RouterLink, ProgressRingComponent],
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Today</p>
        <h1>{{ data()?.greeting ?? "Your ledger" }}</h1>
      </div>
      <a class="button secondary" routerLink="/goal">Goal</a>
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
      <section class="hero-card">
        <ledger-progress-ring
          [value]="d.progress.percentComplete"
          [label]="d.progress.percentComplete + ' percent toward goal'"
        />
        <div class="weight-hero">
          <span>Now</span
          ><strong>{{
            display.fromKg(d.progress.currentWeightKg) | number: "1.1-1"
          }}</strong
          ><small>{{ display.unitLabel }}</small>
        </div>
        <div class="chip-row">
          <span
            >Start <b>{{ display.fromKg(d.progress.startWeightKg) }}</b></span
          ><span
            >Goal <b>{{ display.fromKg(d.progress.goalWeightKg) }}</b></span
          >
        </div>
        <p class="pace">{{ d.progress.pace.message }}</p>
      </section>
      <section class="stat-grid">
        <article>
          <span>This week</span
          ><strong
            >{{ display.fromKg(d.thisWeekChangeKg) | number: "1.1-1" }}
            {{ display.unitLabel }}</strong
          >
        </article>
        <article>
          <span>Weekly pace</span
          ><strong
            >{{ display.fromKg(d.averageWeeklyChangeKg) | number: "1.1-1" }}
            {{ display.unitLabel }}</strong
          >
        </article>
        <article>
          <span>Streak</span><strong>{{ d.currentStreak }} days</strong>
        </article>
      </section>
      <section class="card">
        <div class="section-head">
          <h2>Last 30 days</h2>
          <a routerLink="/trends">View trends</a>
        </div>
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
      </section>
    } `,
})
export class DashboardPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<Dashboard | null>(null);
  loading = signal(true);
  error = signal("");
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.api.dashboard().subscribe({
      next: (x) => {
        this.data.set(x);
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
}

@Component({
  selector: "ledger-log",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Daily record</p>
        <h1>Log your weight</h1>
      </div>
      <a routerLink="/history">History</a>
    </header>
    <section class="entry-card">
      <form [formGroup]="form" (ngSubmit)="save()">
        <label
          >Date<input type="date" formControlName="date" [max]="today" /></label
        ><label class="weight-input"
          ><span>Weight ({{ display.unitLabel }})</span>
          <div>
            <button
              type="button"
              (click)="adjust(-0.1)"
              aria-label="Decrease weight"
            >
              −</button
            ><input
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
          </div></label
        ><label
          >Note <small>optional</small
          ><textarea maxlength="280" formControlName="note" rows="4"></textarea>
        </label>
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <button class="button primary" [disabled]="form.invalid || busy()">
          {{ busy() ? "Saving…" : "Save weigh-in" }}
        </button>
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
  today = new Date().toISOString().slice(0, 10);
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
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Your record</p>
        <h1>History</h1>
      </div>
      <select [value]="sort()" (change)="changeSort($event)">
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
            {{ month.year }}-{{ month.month }}
            <span
              >{{ display.fromKg(month.netChangeKg) | number: "1.1-1" }}
              {{ display.unitLabel }}</span
            >
          </h2>
          @for (entry of month.entries; track entry.id) {
            <article>
              <div>
                <strong>{{ entry.date | date: "EEE, MMM d" }}</strong
                ><small>{{ entry.note }}</small>
              </div>
              <b
                >{{ display.fromKg(entry.weightKg) | number: "1.1-1" }}
                {{ display.unitLabel }}</b
              ><button
                class="icon-button"
                (click)="beginEdit(entry)"
                aria-label="Edit entry"
              >
                ✎</button
              ><button
                class="icon-button"
                (click)="remove(entry.id)"
                aria-label="Delete entry"
              >
                ×
              </button>
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
                  <button class="button primary">Save</button
                  ><button
                    type="button"
                    class="button secondary"
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
        <button class="button secondary" (click)="more()">Load more</button>
      }
    } @else {
      <ledger-empty-state
        title="No entries yet"
        message="Log your first weight to begin your honest record."
      />
    }`,
})
export class HistoryPage {
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<any>(null);
  sort = signal(sessionStorage.getItem("ledger.history.sort") ?? "Newest");
  page = signal(1);
  editingId = signal<string | null>(null);
  editWeight = 0;
  editNote = "";
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
  remove(id: string): void {
    this.api.deleteWeight(id).subscribe(() => {
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
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Direction of travel</p>
        <h1>Trends</h1>
      </div>
      <a routerLink="/history">History</a>
    </header>
    <div class="range-tabs" role="group" aria-label="Time range">
      @for (r of ranges; track r) {
        <button [class.active]="range() === r" (click)="select(r)">
          {{ labels[r] }}
        </button>
      }
    </div>
    @if (data(); as d) {
      @if (d.series.length) {
        <section class="chart-card">
          <div
            class="chart"
            role="img"
            [attr.aria-label]="d.accessibleDescription"
          >
            <svg viewBox="0 0 600 260" preserveAspectRatio="none">
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
          <p class="sr-only">{{ d.accessibleDescription }}</p>
        </section>
        <section class="stat-grid">
          <article>
            <span>Weekly rate</span
            ><strong
              >{{ display.fromKg(d.ratePerWeekKg) | number: "1.2-2" }}
              {{ display.unitLabel }}</strong
            >
          </article>
          <article>
            <span>Total change</span
            ><strong
              >{{ display.fromKg(d.totalChangeKg) | number: "1.1-1" }}
              {{ display.unitLabel }}</strong
            >
          </article>
          <article>
            <span>BMI</span><strong>{{ d.bmi ?? "—" }}</strong>
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
  imports: [CommonModule, ReactiveFormsModule],
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Destination</p>
        <h1>Your goal</h1>
      </div>
    </header>
    @if (data(); as d) {
      <section class="hero-card">
        <div class="weight-hero">
          <span>Progress</span
          ><strong>{{ d.percentComplete | number: "1.0-0" }}%</strong>
        </div>
        <div class="chip-row">
          <span
            >Start
            <b
              >{{ display.fromKg(d.startWeightKg) }} {{ display.unitLabel }}</b
            ></span
          ><span
            >Now
            <b
              >{{ display.fromKg(d.currentWeightKg) }}
              {{ display.unitLabel }}</b
            ></span
          ><span
            >Goal
            <b
              >{{ display.fromKg(d.goalWeightKg) }} {{ display.unitLabel }}</b
            ></span
          >
        </div>
        <p>{{ d.pace.message }}</p>
      </section>
      <section class="card">
        <h2>Edit goal</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label
            >Goal weight ({{ display.unitLabel }})<input
              type="number"
              step="0.1"
              formControlName="goalWeightKg" /></label
          ><label
            >Target date<input type="date" formControlName="targetDate"
          /></label>
          @if (message()) {
            <p role="status">{{ message() }}</p>
          }
          <button class="button primary">Save goal</button>
        </form>
      </section>
    }`,
})
export class GoalPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly display = inject(DisplayPreferencesService);
  data = signal<any>(null);
  message = signal("");
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
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Consistency counts</p>
        <h1>Badges</h1>
      </div>
      <strong>{{ earned() }} of 8</strong>
    </header>
    <section class="badge-grid">
      @for (b of badges(); track b.type) {
        <article [class.locked]="!b.earned">
          <div class="badge-icon" aria-hidden="true">
            {{ b.earned ? "✦" : "◇" }}
          </div>
          <h2>{{ name(b.type) }}</h2>
          <p>{{ b.remaining }}</p>
          <div class="mini-progress"><i [style.width.%]="b.progress"></i></div>
          @if (b.celebrationPending) {
            <span class="badge-new">New</span>
          }
        </article>
      }
    </section>`,
})
export class BadgesPage {
  private api = inject(LedgerApi);
  badges = signal<any[]>([]);
  constructor() {
    this.load();
  }
  earned(): number {
    return this.badges().filter((x) => x.earned).length;
  }
  name(v: string): string {
    return v.replace(/([A-Z])/g, " $1").trim();
  }
  @HostListener("window:ledger-change") onRealtimeChange(): void {
    this.load();
  }
  private load(): void {
    this.api.milestones().subscribe((x: any) => {
      this.badges.set(x);
      for (const badge of x.filter((item: any) => item.celebrationPending))
        this.api.acknowledgeMilestone(badge.id).subscribe();
    });
  }
}

@Component({
  selector: "ledger-account",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Settings</h1>
      </div>
      <button class="button secondary" (click)="signOut()">Sign out</button>
    </header>
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
    @if (message()) {
      <div class="toast" role="status">{{ message() }}</div>
    }`,
})
export class AccountPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private display = inject(DisplayPreferencesService);
  private router = inject(Router);
  confirmation = "";
  message = signal("");
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
