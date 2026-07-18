import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { LedgerApi } from "@ledger/api";

@Component({
  selector: "ledger-sign-in",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<section class="auth-card">
    <div class="auth-logo">◒</div>
    <p class="eyebrow">Welcome back</p>
    <h1>Sign in to Ledger</h1>
    <p class="muted">Your honest record is waiting.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label
        >Email<input
          type="email"
          formControlName="email"
          autocomplete="email" /></label
      ><label
        >Password<input
          type="password"
          formControlName="password"
          autocomplete="current-password"
      /></label>
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
      <button class="button primary" [disabled]="form.invalid || busy()">
        {{ busy() ? "Signing in…" : "Sign in" }}
      </button>
    </form>
    <a routerLink="/forgot-password">Forgot password?</a>
    <p>New here? <a routerLink="/register">Create an account</a></p>
  </section>`,
})
export class SignInPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private router = inject(Router);
  form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", Validators.required],
  });
  error = signal("");
  busy = signal(false);
  submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.api
      .signIn(this.form.value.email!, this.form.value.password!)
      .subscribe({
        next: (x) =>
          this.router.navigateByUrl(x.onboarded ? "/dashboard" : "/onboarding"),
        error: (e) => {
          this.error.set(this.api.problem(e));
          this.busy.set(false);
        },
      });
  }
}

@Component({
  selector: "ledger-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<section class="auth-card wide">
    <p class="eyebrow">Start your record</p>
    <h1>Create your account</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label
        >Full name<input formControlName="name" autocomplete="name" /></label
      ><label
        >Email<input
          type="email"
          formControlName="email"
          autocomplete="email" /></label
      ><label
        >Password<input
          [type]="show() ? 'text' : 'password'"
          formControlName="password"
          autocomplete="new-password"
        /><small>8+ characters, a number, and a symbol</small></label
      ><button type="button" class="link-button" (click)="show.set(!show())">
        {{ show() ? "Hide" : "Show" }} password</button
      ><label class="check"
        ><input type="checkbox" formControlName="termsAccepted" />
        <span
          >I accept the <a href="http://localhost:8081/terms">Terms</a> and
          <a href="http://localhost:8081/privacy">Privacy Policy</a>.</span
        ></label
      >
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
      @if (done()) {
        <div class="banner success" role="status">
          Account created. Check your email to verify it.
          <button type="button" class="link-button" (click)="resend()">
            Resend verification email
          </button>
        </div>
      }
      <button class="button primary" [disabled]="form.invalid || busy()">
        Create account
      </button>
    </form>
    <p>Already have an account? <a routerLink="/sign-in">Sign in</a></p>
  </section>`,
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  form = this.fb.nonNullable.group({
    name: ["", Validators.required],
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
    termsAccepted: [false, Validators.requiredTrue],
  });
  show = signal(false);
  busy = signal(false);
  done = signal(false);
  error = signal("");
  submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.api.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.done.set(true);
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(this.api.problem(e));
        this.busy.set(false);
      },
    });
  }
  resend(): void {
    this.api
      .resendVerification(this.form.controls.email.value)
      .subscribe(() => this.error.set("Verification email resent."));
  }
}

@Component({
  selector: "ledger-forgot",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="auth-card">
    <h1>Reset your password</h1>
    <p class="muted">Enter your email and we’ll send a single-use link.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>Email<input type="email" formControlName="email" /></label
      ><button class="button primary">Send reset link</button>
    </form>
    @if (done()) {
      <p class="banner success" role="status">
        If that email exists, we've sent a link.
      </p>
    }
    <a routerLink="/sign-in">Back to sign in</a>
  </section>`,
})
export class ForgotPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
  });
  done = signal(false);
  submit(): void {
    if (this.form.invalid) return;
    this.api
      .forgotPassword(this.form.value.email!)
      .subscribe(() => this.done.set(true));
  }
}

@Component({
  selector: "ledger-reset",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="auth-card">
    <h1>Set a new password</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label
        >New password<input type="password" formControlName="password"
      /></label>
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
      <button class="button primary">Update password</button>
    </form>
    @if (done()) {
      <p class="banner success">
        Password updated. <a routerLink="/sign-in">Sign in</a>.
      </p>
    }
  </section>`,
})
export class ResetPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private route = inject(ActivatedRoute);
  form = this.fb.nonNullable.group({
    password: ["", [Validators.required, Validators.minLength(8)]],
  });
  done = signal(false);
  error = signal("");
  submit(): void {
    this.api
      .resetPassword(
        this.route.snapshot.queryParamMap.get("token") ?? "",
        this.form.value.password!,
      )
      .subscribe({
        next: () => this.done.set(true),
        error: (e) => this.error.set(this.api.problem(e)),
      });
  }
}

@Component({
  selector: "ledger-verify",
  standalone: true,
  imports: [RouterLink],
  template: `<section class="auth-card">
    <div class="auth-logo">✓</div>
    <h1>{{ message() }}</h1>
    <p class="muted">{{ detail() }}</p>
    <a class="button primary" routerLink="/sign-in">Continue to sign in</a>
  </section>`,
})
export class VerifyPage {
  private api = inject(LedgerApi);
  private route = inject(ActivatedRoute);
  message = signal("Verifying your email…");
  detail = signal("One moment.");
  constructor() {
    this.api
      .verifyEmail(this.route.snapshot.queryParamMap.get("token") ?? "")
      .subscribe({
        next: () => {
          this.message.set("Email verified");
          this.detail.set("Your account is ready.");
        },
        error: (e) => {
          this.message.set("Link unavailable");
          this.detail.set(this.api.problem(e));
        },
      });
  }
}
