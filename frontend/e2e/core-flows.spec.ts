import { expect, Page, Route, test } from '@playwright/test';

const preferences={unit:'Kg',theme:'System',weekStartsOn:'Monday',timeZone:'America/Toronto',reminderEnabled:false,reminderTime:'08:00:00',quietHoursEnabled:false,quietHoursStart:'22:00:00',quietHoursEnd:'07:00:00'};

function dashboard(currentWeightKg=80){return {greeting:'Good morning, Alex',progress:{percentComplete:4,startWeightKg:80,currentWeightKg,goalWeightKg:70,remainingKg:currentWeightKg-70,targetDate:'2026-10-20',reached:false,hasSufficientData:true,pace:{weeklyRateKg:-0.4,message:'On track'}},thisWeekChangeKg:currentWeightKg-80,averageWeeklyChangeKg:-0.4,currentStreak:1,trend:[{id:'entry-1',date:'2026-07-20',weightKg:currentWeightKg,note:'Morning check-in',updatedAt:'2026-07-20T08:00:00Z'}],celebrations:[]};}

async function mockLedger(page:Page,onboarded:boolean){
  const state={onboarded,heightCm:176,currentWeightKg:80};
  await page.route('**/api/v1/**',async(route:Route)=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path.endsWith('/auth/sign-in')||path.endsWith('/auth/refresh'))return json({accessToken:'test-token',accessTokenExpiresAt:'2099-01-01T00:00:00Z',userId:'user-1',name:'Alex Rivera',onboarded:state.onboarded});
    if(path.endsWith('/session'))return json({id:'user-1',name:'Alex Rivera',email:'alex@example.test',emailVerified:true,onboarded:state.onboarded});
    if(path.endsWith('/onboarding')&&request.method()==='GET')return json({complete:false,draft:null});
    if(path.endsWith('/onboarding')&&request.method()==='PATCH')return json({});
    if(path.endsWith('/onboarding/complete')){state.onboarded=true;return json({});}
    if(path.endsWith('/profile')&&request.method()==='GET')return json({name:'Alex Rivera',email:'alex@example.test',heightCm:state.heightCm});
    if(path.endsWith('/profile')&&request.method()==='PUT'){state.heightCm=request.postDataJSON().heightCm;return json({});}
    if(path.endsWith('/preferences'))return json(preferences);
    if(path.endsWith('/dashboard'))return json(dashboard(state.currentWeightKg));
    if(path.endsWith('/weigh-ins')&&request.method()==='POST'){state.currentWeightKg=request.postDataJSON().weightKg;return json({id:'entry-1'});}
    return json({});
  });
  return state;
}

async function signIn(page:Page){
  await page.goto('/sign-in');
  await page.getByRole('textbox',{name:'Email'}).fill('alex@example.test');
  await page.getByRole('textbox',{name:'Password'}).fill('Aurora123!');
  await page.getByRole('button',{name:'Sign in'}).click();
}

test('onboarding stays within the viewport and completes profile setup',async({page},testInfo)=>{
  if(testInfo.project.name.includes('mobile'))await page.setViewportSize({width:390,height:844});
  await mockLedger(page,false);
  await signIn(page);
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('link',{name:'Get started'}).click();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'What do you weigh now?'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('textbox',{name:'Current weight'}).fill('80');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'What’s your goal weight?'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('textbox',{name:'Goal weight'}).fill('70');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('textbox',{name:'Target date'}).fill('2026-10-20');
  await page.getByRole('button',{name:'Finish setup'}).click();
  await page.getByRole('spinbutton',{name:'Height optional'}).fill('176');
  await page.getByRole('button',{name:'Finish setup'}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('height and full-page weight updates are reflected in the UI',async({context,page})=>{
  const state=await mockLedger(page,true);
  await context.addCookies([{name:'ledger_csrf',value:'test',domain:'127.0.0.1',path:'/'}]);
  await signIn(page);
  await page.getByRole('link',{name:'Profile'}).click();
  await page.getByRole('button',{name:/Height 176 cm/}).click();
  await page.getByRole('spinbutton',{name:'Height cm'}).fill('180');
  await page.getByRole('button',{name:'Save height'}).click();
  await expect(page.getByRole('status')).toContainText('Height saved');
  expect(state.heightCm).toBe(180);

  await page.goto('/log');
  await page.getByRole('textbox',{name:'Weight'}).fill('79.6');
  await page.getByRole('textbox',{name:/Add a note/}).fill('Morning check-in');
  await page.getByRole('button',{name:'Save weight'}).click();
  await expect(page.getByRole('status')).toContainText('Weight logged');
  expect(state.currentWeightKg).toBe(79.6);
  await page.goto('/dashboard');
  await expect(page.getByRole('img',{name:/current weight 79.6 kg/})).toBeVisible();
});
