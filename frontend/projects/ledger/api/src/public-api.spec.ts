import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AuthStore,
  authInterceptor,
  requireNeedsOnboarding,
  requireOnboarded,
} from './public-api';

describe('authentication route guards', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    document.cookie = 'ledger_csrf=test-csrf; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    document.cookie = 'ledger_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('restores authentication before requesting the protected session', async () => {
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() => requireOnboarded()),
    );

    const refresh = http.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.method).toBe('POST');
    http.expectNone('/api/v1/session');
    refresh.flush({
      accessToken: 'restored-token',
      accessTokenExpiresAt: '2026-07-19T02:00:00Z',
      userId: 'e72bb2a2-970d-4b7c-b573-2ee59e6a7edf',
      name: 'Quinntyne Brown',
      onboarded: false,
    });

    const session = http.expectOne('/api/v1/session');
    expect(session.request.headers.get('Authorization')).toBe(
      'Bearer restored-token',
    );
    session.flush({
      id: 'e72bb2a2-970d-4b7c-b573-2ee59e6a7edf',
      name: 'Quinntyne Brown',
      email: 'member@example.com',
      emailVerified: true,
      onboarded: false,
    });

    const route = await result;
    expect(route).not.toBe(true);
    expect(router.serializeUrl(route as UrlTree)).toBe('/onboarding');
  });

  it('uses an existing access token without rotating the refresh session', async () => {
    TestBed.inject(AuthStore).accessToken.set('current-token');
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() => requireNeedsOnboarding()),
    );

    http.expectNone('/api/v1/auth/refresh');
    const session = http.expectOne('/api/v1/session');
    session.flush({
      id: 'e72bb2a2-970d-4b7c-b573-2ee59e6a7edf',
      name: 'Quinntyne Brown',
      email: 'member@example.com',
      emailVerified: true,
      onboarded: true,
    });

    const route = await result;
    expect(route).not.toBe(true);
    expect(router.serializeUrl(route as UrlTree)).toBe('/dashboard');
  });

  it('redirects an anonymous browser without making a failing refresh request', async () => {
    document.cookie = 'ledger_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => requireOnboarded()),
    );

    http.expectNone('/api/v1/auth/refresh');
    http.expectNone('/api/v1/session');
    expect(router.serializeUrl(result as UrlTree)).toBe('/sign-in');
  });
});
