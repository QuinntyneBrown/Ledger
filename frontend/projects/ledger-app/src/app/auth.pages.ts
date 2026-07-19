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
        <div class="au-input-wrap"><svg class="au-icon"><use href="#i-lock" /></svg><input id="password" class="au-input" type="password" formControlName="password" placeholder="Enter your password" autocomplete="current-password" /></div>
        @if (error()) { <p class="au-help is-error" role="alert"><svg class="au-icon"><use href="#i-alert-circle" /></svg>{{ error() }}</p> }
      </div>
      <button class="au-btn au-btn--primary au-btn--lg au-btn--block" [disabled]="form.invalid || busy()">{{ busy() ? "Signing in…" : "Sign in" }}</button>
    </form>
    <div class="auth-divider">or</div>
    <div class="auth-social"><button type="button" class="au-btn au-btn--outlined au-btn--lg au-btn--block" (click)="socialMessage.set('Google sign-in is not configured yet.')">Continue with Google</button><button type="button" class="au-btn au-btn--outlined au-btn--lg au-btn--block" (click)="socialMessage.set('Apple sign-in is not configured yet.')">Continue with Apple</button></div>
    <p class="auth-alt">New here? <a routerLink="/register">Create an account</a></p>
    @if (socialMessage()) { <div class="toast" role="status">{{ socialMessage() }}</div> }
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
