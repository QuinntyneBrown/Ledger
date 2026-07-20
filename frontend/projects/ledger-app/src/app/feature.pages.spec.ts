import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { LedgerApi } from "@ledger/api";
import { of, throwError } from "rxjs";
import {
  AccountPage,
  BadgesPage,
  HistoryPage,
  OnboardingPage,
} from "./feature.pages";

describe("OnboardingPage", () => {
  const accountPreferences = {
    unit: "Kg" as const,
    theme: "System" as const,
    weekStartsOn: "Monday" as const,
    timeZone: "America/Toronto",
    reminderEnabled: false,
    reminderTime: "08:00:00",
    quietHoursEnabled: false,
    quietHoursStart: "22:00:00",
    quietHoursEnd: "07:00:00",
  };
  const api = {
    onboarding: jest.fn(),
    saveOnboarding: jest.fn(),
    completeOnboarding: jest.fn(),
    history: jest.fn(),
    milestones: jest.fn(),
    acknowledgeMilestone: jest.fn(),
    signOut: jest.fn(),
    problem: jest.fn(),
    dashboard: jest.fn(),
    profile: jest.fn(),
    preferences: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    changePassword: jest.fn(),
    updatePreferences: jest.fn(),
    scheduleReminder: jest.fn(),
    pushPublicKey: jest.fn(),
    savePushSubscription: jest.fn(),
    deleteData: jest.fn(),
    exportData: jest.fn(),
    deleteAccount: jest.fn(),
  };
  const router = {
    navigateByUrl: jest.fn(),
    createUrlTree: jest.fn(() => ({ toString: () => "/trends" })),
    serializeUrl: jest.fn(() => "/trends"),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    api.onboarding.mockReturnValue(of({ complete: false, draft: null }));
    api.saveOnboarding.mockReturnValue(of({}));
    api.problem.mockReturnValue("Please try again.");
    api.acknowledgeMilestone.mockReturnValue(of(undefined));
    api.dashboard.mockReturnValue(of(null));
    api.profile.mockReturnValue(
      of({ name: "Alex", email: "alex@email.com", heightCm: 176 }),
    );
    api.preferences.mockReturnValue(of(accountPreferences));
    api.updateProfile.mockReturnValue(of(undefined));
    api.uploadAvatar.mockReturnValue(of({ url: "/avatars/alex.jpg" }));
    api.changePassword.mockReturnValue(of(undefined));
    api.updatePreferences.mockReturnValue(of(accountPreferences));
    api.scheduleReminder.mockReturnValue(of(accountPreferences));
    await TestBed.configureTestingModule({
      imports: [OnboardingPage, HistoryPage, BadgesPage, AccountPage],
      providers: [
        { provide: LedgerApi, useValue: api },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();
  });

  it("sends nullable fields instead of an empty target date while saving progress", () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    const page = fixture.componentInstance;

    page.next();

    expect(api.saveOnboarding).toHaveBeenLastCalledWith({
      lastCompletedStep: 1,
      unit: "Kg",
      currentWeightKg: null,
      goalWeightKg: null,
      targetDate: null,
    });
    expect(page.step()).toBe(2);

    page.next();

    expect(api.saveOnboarding).toHaveBeenLastCalledWith({
      lastCompletedStep: 2,
      unit: "Kg",
      currentWeightKg: 80,
      goalWeightKg: null,
      targetDate: null,
    });
    expect(page.step()).toBe(3);
  });

  it("shows a recoverable error when draft persistence fails", () => {
    api.saveOnboarding.mockReturnValue(
      throwError(() => new Error("request failed")),
    );
    const page = TestBed.createComponent(OnboardingPage).componentInstance;

    page.next();

    expect(page.step()).toBe(1);
    expect(page.error()).toBe("Please try again.");
  });

  it("renders date-only history values without shifting time zones", () => {
    api.history.mockReturnValue(
      of({
        total: 1,
        page: 1,
        hasMore: false,
        months: [
          {
            year: 2026,
            month: 7,
            netChangeKg: 0,
            entries: [
              {
                id: "entry-1",
                date: "2026-07-19",
                weightKg: 80,
                note: null,
              },
            ],
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(HistoryPage);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("July 2026");
    expect(fixture.nativeElement.textContent).toContain("Sun, Jul 19");
    expect(fixture.nativeElement.textContent).not.toContain("2026-7");
  });

  it("acknowledges a newly earned badge by its milestone id", () => {
    api.milestones.mockReturnValue(
      of([
        {
          id: "milestone-1",
          type: "FirstEntry",
          earned: true,
          remaining: "Earned",
          progress: 100,
          celebrationPending: true,
        },
      ]),
    );

    const fixture = TestBed.createComponent(BadgesPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.celebrating()?.id).toBe("milestone-1");
    fixture.componentInstance.dismissCelebration();

    expect(api.acknowledgeMilestone).toHaveBeenCalledWith("milestone-1");
  });

  it("edits height through a focused dialog instead of the inline forms", () => {
    const fixture = TestBed.createComponent(AccountPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.openHeightEdit();

    expect(page.editor()).toBe("height");
    expect(page.heightDraft).toBe(176);

    page.heightDraft = 180;
    page.saveHeight();

    expect(api.updateProfile).toHaveBeenCalledWith({
      name: "Alex",
      email: "alex@email.com",
      heightCm: 180,
    });
    expect(page.editor()).toBeNull();
    expect(page.savedProfile.heightCm).toBe(180);
    expect(page.profile.controls.heightCm.value).toBe(180);
    expect(page.message()).toBe("Height saved");
  });

  it("keeps the height dialog open for an out-of-range value", () => {
    const page = TestBed.createComponent(AccountPage).componentInstance;
    page.openHeightEdit();
    page.heightDraft = 40;
    page.saveHeight();

    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(page.editor()).toBe("height");
    expect(page.editorError()).toBe("Enter a height between 50 and 272 cm.");
  });

  it("discards unsaved profile edits when its focused editor is cancelled", () => {
    const page = TestBed.createComponent(AccountPage).componentInstance;

    page.openEditor("profile");
    page.profile.patchValue({ name: "Unsaved", email: "draft@email.com" });
    page.closeEditor();
    page.openEditor("profile");

    expect(page.profile.getRawValue()).toEqual({
      name: "Alex",
      email: "alex@email.com",
      heightCm: 176,
    });
    expect(page.savedProfile.name).toBe("Alex");
  });

  it("shows a newly uploaded profile photo immediately", () => {
    const fixture = TestBed.createComponent(AccountPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.openEditor("profile");
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const photo = new File(["photo"], "camera.heic", { type: "image/heic" });
    Object.defineProperty(input, "files", { value: [photo] });

    input.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(api.uploadAvatar).toHaveBeenCalledWith(photo);
    expect(page.savedProfile.avatarUrl).toBe("/avatars/alex.jpg");
    expect(
      fixture.nativeElement.querySelector(".profile-hero .au-avatar img")
        .getAttribute("src"),
    ).toBe("/avatars/alex.jpg");
  });

  it("validates password confirmation before saving the security editor", () => {
    const page = TestBed.createComponent(AccountPage).componentInstance;
    page.openEditor("password");
    page.password.setValue({
      currentPassword: "Old-password1!",
      newPassword: "Fresh-password1!",
      confirmPassword: "Different-password1!",
    });

    page.changePassword();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(page.editor()).toBe("password");
    expect(page.editorError()).toContain("match");

    page.password.controls.confirmPassword.setValue("Fresh-password1!");
    page.changePassword();

    expect(api.changePassword).toHaveBeenCalledWith(
      "Old-password1!",
      "Fresh-password1!",
    );
    expect(page.editor()).toBeNull();
    expect(page.message()).toBe("Password changed");
  });

  it("saves preferences without revealing unrelated account forms", () => {
    const updatedPreferences = {
      ...accountPreferences,
      unit: "Lbs" as const,
      theme: "Dark" as const,
      weekStartsOn: "Sunday" as const,
    };
    api.updatePreferences.mockReturnValue(of(updatedPreferences));
    const page = TestBed.createComponent(AccountPage).componentInstance;
    page.openEditor("preferences");
    page.prefs.setValue({ unit: "Lbs", theme: "Dark", weekStartsOn: "Sunday" });

    page.savePrefs();

    expect(api.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: "Lbs",
        theme: "Dark",
        weekStartsOn: "Sunday",
      }),
    );
    expect(page.savedPreferences).toEqual(updatedPreferences);
    expect(page.editor()).toBeNull();
  });

  it("keeps a focused editor open and reports API failures in place", () => {
    api.updatePreferences.mockReturnValue(
      throwError(() => new Error("request failed")),
    );
    const page = TestBed.createComponent(AccountPage).componentInstance;
    page.openEditor("preferences");

    page.savePrefs();

    expect(page.editor()).toBe("preferences");
    expect(page.editorBusy()).toBe(false);
    expect(page.editorError()).toBe("Please try again.");
  });
});
