import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import * as signalR from "@microsoft/signalr";
import {
  BehaviorSubject,
  catchError,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from "rxjs";
import { AuthResult, Dashboard, Preferences, Session } from "@ledger/domain";

export const API_URL = "/api/v1";

@Injectable({ providedIn: "root" })
export class AuthStore {
  readonly accessToken = signal<string | null>(null);
  readonly session = signal<Session | null>(null);
  setAuth(result: AuthResult): void {
    this.accessToken.set(result.accessToken);
  }
  clear(): void {
    this.accessToken.set(null);
    this.session.set(null);
  }
}

@Injectable({ providedIn: "root" })
export class DisplayPreferencesService {
  private static readonly poundsPerKilogram = 2.2046226218;
  readonly preferences = signal<Preferences>({
    unit: "Kg",
    theme: "System",
    weekStartsOn: "Monday",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminderEnabled: false,
    reminderTime: "08:00:00",
    quietHoursEnabled: false,
    quietHoursStart: "22:00:00",
    quietHoursEnd: "07:00:00",
  });
  constructor() {
    const cached = localStorage.getItem("ledger.preferences");
    if (cached) {
      try {
        this.apply(JSON.parse(cached) as Preferences, false);
      } catch {
        localStorage.removeItem("ledger.preferences");
      }
    }
  }
  get unitLabel(): string {
    return this.preferences().unit === "Lbs" ? "lb" : "kg";
  }
  fromKg(value: number): number {
    return this.preferences().unit === "Lbs"
      ? this.round(value * DisplayPreferencesService.poundsPerKilogram)
      : this.round(value);
  }
  toKg(value: number): number {
    return this.preferences().unit === "Lbs"
      ? this.round(value / DisplayPreferencesService.poundsPerKilogram, 3)
      : this.round(value);
  }
  apply(preferences: Preferences, persist = true): void {
    this.preferences.set(preferences);
    if (persist)
      localStorage.setItem("ledger.preferences", JSON.stringify(preferences));
    const theme = preferences.theme.toLowerCase();
    document.documentElement.dataset["theme"] =
      theme === "system"
        ? matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : theme;
  }
  private round(value: number, digits = 1): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const token = auth.accessToken();
  let headers = request.headers;
  if (token) headers = headers.set("Authorization", `Bearer ${token}`);
  const csrf = cookieValue("ledger_csrf");
  if (csrf) headers = headers.set("X-CSRF", decodeURIComponent(csrf));
  return next(request.clone({ headers, withCredentials: true }));
};

@Injectable({ providedIn: "root" })
export class LedgerApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  register(body: {
    name: string;
    email: string;
    password: string;
    termsAccepted: boolean;
  }): Observable<unknown> {
    return this.http.post(`${API_URL}/auth/register`, body);
  }
  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/verify-email`, { token });
  }
  resendVerification(email: string): Observable<unknown> {
    return this.http.post(`${API_URL}/auth/resend-verification`, { email });
  }
  signIn(email: string, password: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_URL}/auth/sign-in`, { email, password })
      .pipe(tap((x) => this.auth.setAuth(x)));
  }
  refresh(): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_URL}/auth/refresh`, {})
      .pipe(tap((x) => this.auth.setAuth(x)));
  }
  signOut(): Observable<void> {
    return this.http
      .post<void>(`${API_URL}/auth/sign-out`, {})
      .pipe(tap(() => this.auth.clear()));
  }
  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${API_URL}/auth/forgot-password`, { email });
  }
  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/reset-password`, {
      token,
      newPassword,
    });
  }
  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }
  getSession(): Observable<Session> {
    return this.http
      .get<Session>(`${API_URL}/session`)
      .pipe(tap((x) => this.auth.session.set(x)));
  }
  onboarding(): Observable<{ complete: boolean; draft: unknown }> {
    return this.http.get<{ complete: boolean; draft: unknown }>(
      `${API_URL}/onboarding`,
    );
  }
  saveOnboarding(body: unknown): Observable<unknown> {
    return this.http.patch(`${API_URL}/onboarding`, body);
  }
  completeOnboarding(body: unknown): Observable<unknown> {
    return this.http.post(`${API_URL}/onboarding/complete`, body);
  }
  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${API_URL}/dashboard`);
  }
  logWeight(body: {
    date: string;
    weightKg: number;
    note?: string;
  }): Observable<unknown> {
    return this.http.post(`${API_URL}/weigh-ins`, body);
  }
  history(sort = "Newest", page = 1): Observable<unknown> {
    return this.http.get(`${API_URL}/weigh-ins`, {
      params: { sort, page, pageSize: 50 },
    });
  }
  editWeight(id: string, body: unknown): Observable<unknown> {
    return this.http.put(`${API_URL}/weigh-ins/${id}`, body);
  }
  deleteWeight(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/weigh-ins/${id}`);
  }
  goal(): Observable<unknown> {
    return this.http.get(`${API_URL}/goals/progress`);
  }
  setGoal(body: unknown): Observable<unknown> {
    return this.http.put(`${API_URL}/goals`, body);
  }
  trends(range = "OneMonth"): Observable<unknown> {
    return this.http.get(`${API_URL}/trends`, { params: { range } });
  }
  milestones(): Observable<unknown> {
    return this.http.get(`${API_URL}/milestones`);
  }
  acknowledgeMilestone(id: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/milestones/${id}/acknowledge`, {});
  }
  preferences(): Observable<Preferences> {
    return this.http.get<Preferences>(`${API_URL}/preferences`);
  }
  updatePreferences(body: Partial<Preferences>): Observable<Preferences> {
    return this.http.patch<Preferences>(`${API_URL}/preferences`, body);
  }
  scheduleReminder(body: unknown): Observable<Preferences> {
    return this.http.put<Preferences>(`${API_URL}/reminders`, body);
  }
  profile(): Observable<unknown> {
    return this.http.get(`${API_URL}/profile`);
  }
  updateProfile(body: unknown): Observable<void> {
    return this.http.put<void>(`${API_URL}/profile`, body);
  }
  uploadAvatar(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append("file", file);
    return this.http.post<{ url: string }>(`${API_URL}/profile/avatar`, body);
  }
  pushPublicKey(): Observable<{ publicKey: string }> {
    return this.http.get<{ publicKey: string }>(`${API_URL}/push/public-key`);
  }
  savePushSubscription(body: unknown): Observable<void> {
    return this.http.post<void>(`${API_URL}/push-subscriptions`, body);
  }
  deleteData(confirmation: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/account/data`, {
      body: { confirmation },
    });
  }
  exportData(): Observable<Blob> {
    return this.http.get(`${API_URL}/account/export`, { responseType: "blob" });
  }
  deleteAccount(confirmation: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/account`, {
      body: { confirmation },
    });
  }
  problem(error: unknown): string {
    const e = error as HttpErrorResponse;
    const body = e.error as {
      title?: string;
      errors?: Record<string, string[]>;
    };
    return (
      Object.values(body?.errors ?? {}).flat()[0] ??
      body?.title ??
      "Something went wrong. Please try again."
    );
  }
}

@Injectable({ providedIn: "root" })
export class RealtimeService {
  private readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private connection?: signalR.HubConnection;
  readonly changes = new BehaviorSubject<unknown>(null);
  async connect(): Promise<void> {
    if (this.connection) return;
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/ledger", {
        accessTokenFactory: () => this.auth.accessToken() ?? "",
      })
      .withAutomaticReconnect()
      .build();
    this.connection.on("change", (x) => this.apply(x));
    this.connection.onreconnected(() => this.reconcile());
    await this.connection.start();
  }
  private apply(change: any): void {
    const stamp = change?.serverTimestamp ?? change?.data?.updatedAt;
    if (stamp) localStorage.setItem("ledger.sync.watermark", stamp);
    this.changes.next(change);
    window.dispatchEvent(new CustomEvent("ledger-change", { detail: change }));
  }
  private reconcile(): void {
    const since = localStorage.getItem("ledger.sync.watermark") ?? "";
    this.http
      .get<any[]>(`${API_URL}/sync/changes`, { params: { since } })
      .subscribe((changes) => {
        for (const change of changes) this.apply(change);
        this.apply({ kind: "reconcile" });
      });
  }
}

function restoreAuthentication(): Observable<true | UrlTree> {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const api = inject(LedgerApi);
  if (auth.accessToken()) return of(true);
  if (!cookieValue("ledger_csrf")) return of(router.parseUrl("/sign-in"));
  return api.refresh().pipe(
    map(() => true as const),
    catchError(() => {
      auth.clear();
      return of(router.parseUrl("/sign-in"));
    }),
  );
}

export function requireAuth(): Observable<true | UrlTree> {
  return restoreAuthentication();
}

function requireSessionRoute(
  selectRoute: (session: Session, router: Router) => true | UrlTree,
): Observable<true | UrlTree> {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const api = inject(LedgerApi);
  return restoreAuthentication().pipe(
    switchMap((authenticated) =>
      authenticated === true
        ? api.getSession().pipe(
            map((session) => selectRoute(session, router)),
            catchError(() => {
              auth.clear();
              return of(router.parseUrl("/sign-in"));
            }),
          )
        : of(authenticated),
    ),
  );
}

export function requireOnboarded(): Observable<true | UrlTree> {
  return requireSessionRoute((session, router) =>
    session.onboarded ? true : router.parseUrl("/onboarding"),
  );
}

export function requireNeedsOnboarding(): Observable<true | UrlTree> {
  return requireSessionRoute((session, router) =>
    session.onboarded ? router.parseUrl("/dashboard") : true,
  );
}
