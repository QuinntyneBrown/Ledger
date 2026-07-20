import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { LedgerApi } from "@ledger/api";
import { NEVER, of } from "rxjs";
import { RegisterPage, VerifyPage } from "./auth.pages";

describe("authentication pages", () => {
  const api = {
    register: jest.fn(() => of(undefined)),
    resendVerification: jest.fn(() => of(undefined)),
    verifyEmail: jest.fn(() => NEVER),
    problem: jest.fn(() => "Please try again."),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RegisterPage, VerifyPage],
      providers: [{ provide: LedgerApi, useValue: api }, provideRouter([])],
    }).compileComponents();
  });

  it("requires the password policy and exposes strength feedback", () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;

    page.form.patchValue({
      name: "Alex Rivera",
      email: "alex@example.test",
      password: "abcdefgh!",
      termsAccepted: true,
    });
    expect(page.form.controls.password.invalid).toBe(true);

    page.form.controls.password.setValue("Aurora123!");
    fixture.detectChanges();

    expect(page.form.controls.password.valid).toBe(true);
    expect(page.passwordScore()).toBe(4);
    expect(page.passwordHelp()).toContain("Strong");
    expect(fixture.nativeElement.querySelectorAll(".pw-meter .is-on")).toHaveLength(4);
  });

  it("does not show the verification continuation while verification is pending", () => {
    const fixture = TestBed.createComponent(VerifyPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Verifying your email");
    expect(fixture.nativeElement.textContent).not.toContain("Continue to sign in");
  });
});
