import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { LedgerApi } from "@ledger/api";
import { of, throwError } from "rxjs";
import { BadgesPage, HistoryPage, OnboardingPage } from "./feature.pages";

describe("OnboardingPage", () => {
  const api = {
    onboarding: jest.fn(),
    saveOnboarding: jest.fn(),
    completeOnboarding: jest.fn(),
    history: jest.fn(),
    milestones: jest.fn(),
    acknowledgeMilestone: jest.fn(),
    signOut: jest.fn(),
    problem: jest.fn(),
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
    await TestBed.configureTestingModule({
      imports: [OnboardingPage, HistoryPage, BadgesPage],
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
});
