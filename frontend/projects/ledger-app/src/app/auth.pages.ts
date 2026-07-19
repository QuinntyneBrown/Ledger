import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { LedgerApi } from "@ledger/api";

const publicSiteUrl = (): string =>
  typeof location !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:4300"
    : "https://thankful-coast-02639fc0f.7.azurestaticapps.net";

@Component({
  selector: "ledger-sign-in",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<section class="auth-card au-card au-card--pad-lg au-rise au-rise-1">
    <div class="auth-logo-lockup">
      <div class="auth-mark"></div>
      <div><h1 class="auth-title">Welcome back</h1><div class="auth-sub">Sign in to continue to Ledger</div></div>
    </div>
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="au-field">
        <label class="au-label" for="email">Email</label>
        <div class="au-input-wrap"><svg class="au-icon"><use href="#i-mail" /></svg><input id="email" class="au-input" type="email" formControlName="email" placeholder="you@email.com" autocomplete="email" /></div>
      </div>
      <div class="au-field" [class.is-error]="error()">
        <div class="auth-inline"><label class="au-label" for="password">Password</label><a routerLink="/forgot-password">Forgot password?</a></div>
        <div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input id="password" class="au-input" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="Enter your password" autocomplete="current-password" /><button type="button" class="auth-pw-toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"><svg class="au-icon"><use [attr.href]="showPassword() ? '#i-eye-off' : '#i-eye'" /></svg></button></div>
        @if (error()) { <p class="au-help is-error" role="alert"><svg class="au-icon"><use href="#i-alert-circle" /></svg>{{ error() }}</p> }
      </div>
      <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid || busy()">{{ busy() ? "Signing in…" : "Sign in" }}</button>
    </form>
    <div class="auth-divider">or</div>
    <div class="auth-social"><button type="button" class="au-btn au-btn--outlined au-btn--lg au-btn--block" (click)="socialMessage.set('Google sign-in is not configured yet.')"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 32 15l5.7-5.6A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 32 15l5.7-5.6A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.1H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41.2 35.3 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>Continue with Google</button><button type="button" class="au-btn au-btn--outlined au-btn--lg au-btn--block" (click)="socialMessage.set('Apple sign-in is not configured yet.')"><svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.94 4.54c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z"/></svg>Continue with Apple</button></div>
    <p class="auth-alt">New here? <a routerLink="/register">Create an account</a></p>
    @if (socialMessage()) { <div class="au-toast-region app-toast-region"><div class="au-toast au-toast--info" role="status"><svg class="au-icon au-toast-icon"><use href="#i-info" /></svg><span class="au-toast-msg">{{ socialMessage() }}</span></div></div> }
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
  showPassword = signal(false);
  socialMessage = signal("");
  submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.api
      .signIn(this.form.value.email!, this.form.value.password!)
      .subscribe({
        next: (x) =>
          this.router.navigateByUrl(x.onboarded ? "/dashboard" : "/welcome"),
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
  template: `<section class="auth-card wide au-card au-card--pad-lg au-rise au-rise-1">
    <div class="auth-logo-lockup"><div class="auth-mark"></div><div><h1 class="auth-title">Create your account</h1><div class="auth-sub">Start tracking in under a minute</div></div></div>
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="au-field"><label class="au-label" for="name">Full name</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-user" /></svg><input id="name" class="au-input" formControlName="name" placeholder="Your name" autocomplete="name" /></div></div>
      <div class="au-field"><label class="au-label" for="register-email">Email</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-mail" /></svg><input id="register-email" class="au-input" type="email" formControlName="email" placeholder="you@email.com" autocomplete="email" /></div></div>
      <div class="au-field"><label class="au-label" for="register-password">Password</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input id="register-password" class="au-input" [type]="show() ? 'text' : 'password'" formControlName="password" placeholder="Create a password" autocomplete="new-password" /><button type="button" class="au-icon-btn au-icon-btn--sm" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><svg class="au-icon"><use [attr.href]="show() ? '#i-eye-off' : '#i-eye'" /></svg></button></div><p class="au-help">At least 8 characters with a number and symbol.</p></div>
      <label class="au-check"><input type="checkbox" formControlName="termsAccepted" /><span class="au-box"><svg class="au-icon"><use href="#i-check" /></svg></span><span class="au-text-mid">I agree to the <a [href]="legalSiteUrl + '/terms'">Terms of Service</a> and <a [href]="legalSiteUrl + '/privacy'">Privacy Policy</a>.</span></label>
      @if (error()) { <p class="au-help is-error" role="alert">{{ error() }}</p> }
      @if (done()) { <div class="au-banner au-banner--good" role="status"><svg class="au-icon"><use href="#i-check-circle" /></svg><div class="au-banner-body"><div class="au-banner-title">Check your email</div><div class="au-banner-text">Account created. Open the verification link to continue.</div><button type="button" class="au-btn au-btn--text au-btn--sm" (click)="resend()">Resend email</button></div></div> }
      <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid || busy()">{{ busy() ? "Creating…" : "Create account" }}</button>
    </form>
    <p class="auth-alt">Already have an account? <a routerLink="/sign-in">Sign in</a></p>
  </section>`,
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  readonly legalSiteUrl = publicSiteUrl();
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
  template: `<section class="auth-card au-card au-card--pad-lg au-rise au-rise-1">
    <div class="auth-logo-lockup"><div class="auth-mark"></div><div><h1 class="auth-title">Reset your password</h1><div class="auth-sub">Enter the email tied to your account and we’ll send a secure link.</div></div></div>
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="au-field"><label class="au-label" for="forgot-email">Email</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-mail" /></svg><input id="forgot-email" class="au-input" type="email" formControlName="email" placeholder="you@email.com" autocomplete="email" /></div></div>
      <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid"><svg class="au-icon"><use href="#i-mail" /></svg>Send reset link</button>
    </form>
    @if (done()) { <div class="au-banner au-banner--good" role="status"><svg class="au-icon"><use href="#i-check-circle" /></svg><div class="au-banner-body"><div class="au-banner-title">Reset link sent</div><div class="au-banner-text">If that email exists, a secure link is on its way.</div></div></div> }
    <p class="auth-alt"><a routerLink="/sign-in"><svg class="au-icon auth-back-icon"><use href="#i-arrow-left" /></svg>Back to sign in</a></p>
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
  template: `<section class="auth-card au-card au-card--pad-lg au-rise au-rise-1">
    <div class="auth-logo-lockup"><div class="auth-mark"></div><div><h1 class="auth-title">Set a new password</h1><div class="auth-sub">Choose a strong password you haven’t used before.</div></div></div>
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="au-field"><label class="au-label" for="new-password">New password</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input id="new-password" class="au-input" type="password" formControlName="password" placeholder="Create a password" autocomplete="new-password" /></div><p class="au-help">At least 8 characters with a number and symbol.</p></div>
      <div class="au-field" [class.is-success]="form.controls.confirmPassword.value && form.controls.confirmPassword.value === form.controls.password.value"><label class="au-label" for="confirm-password">Confirm password</label><div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input id="confirm-password" class="au-input" type="password" formControlName="confirmPassword" placeholder="Re-enter your password" autocomplete="new-password" /></div>@if (form.controls.confirmPassword.value && form.controls.confirmPassword.value === form.controls.password.value) { <p class="au-help auth-match"><svg class="au-icon"><use href="#i-check-circle" /></svg>Passwords match</p> }</div>
      @if (error()) { <div class="au-banner au-banner--bad" role="alert"><svg class="au-icon"><use href="#i-alert-triangle" /></svg><div class="au-banner-body"><div class="au-banner-title">This link is unavailable</div><div class="au-banner-text">{{ error() }}</div><a class="au-btn au-btn--outlined au-btn--sm au-mt-4" routerLink="/forgot-password">Request a new link</a></div></div> }
      <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid">Update password</button>
    </form>
    @if (done()) { <div class="au-banner au-banner--good"><svg class="au-icon"><use href="#i-check-circle" /></svg><div class="au-banner-body"><div class="au-banner-title">Password updated</div><a routerLink="/sign-in">Continue to sign in</a></div></div> }
  </section>`,
})
export class ResetPage {
  private fb = inject(FormBuilder);
  private api = inject(LedgerApi);
  private route = inject(ActivatedRoute);
  form = this.fb.nonNullable.group({
    password: ["", [Validators.required, Validators.minLength(8)]],
    confirmPassword: ["", Validators.required],
  });
  done = signal(false);
  error = signal("");
  submit(): void {
    if (this.form.invalid || this.form.controls.password.value !== this.form.controls.confirmPassword.value) { this.error.set("Passwords must match."); return; }
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
  template: `<section class="auth-card au-card au-card--pad-lg au-rise au-rise-1">
    <div class="au-empty">
      <div class="au-empty-art"><svg class="au-icon"><use [attr.href]="message() === 'Email verified' ? '#i-check-circle' : '#i-mail'" /></svg></div>
      <h1 class="au-empty-title">{{ message() }}</h1>
      <p class="au-empty-text">{{ detail() }}</p>
      <a class="au-btn au-btn--primary au-btn--lg au-btn--block au-mt-4" routerLink="/sign-in">Continue to sign in</a>
    </div>
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
