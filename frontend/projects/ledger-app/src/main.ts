import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AppComponent, routes } from './app/app.component';
import { authInterceptor } from '@ledger/api';

bootstrapApplication(AppComponent,{providers:[provideHttpClient(withInterceptors([authInterceptor])),provideRouter(routes,withComponentInputBinding())]}).catch(console.error);
