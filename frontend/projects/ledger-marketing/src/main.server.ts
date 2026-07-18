import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideRouter } from '@angular/router';
import { MarketingComponent, marketingRoutes } from './marketing.component';
import { serverRoutes } from './server.routes';
const bootstrap=(context:BootstrapContext)=>bootstrapApplication(MarketingComponent,{providers:[provideRouter(marketingRoutes),provideServerRendering(withRoutes(serverRoutes))]},context);
export default bootstrap;
