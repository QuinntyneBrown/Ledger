import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MarketingComponent, marketingRoutes } from './marketing.component';
bootstrapApplication(MarketingComponent,{providers:[provideRouter(marketingRoutes)]}).catch(console.error);
