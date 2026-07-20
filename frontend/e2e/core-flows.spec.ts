import { expect, Page, Route, test } from '@playwright/test';

const preferences={unit:'Kg',theme:'System',weekStartsOn:'Monday',timeZone:'America/Toronto',reminderEnabled:false,reminderTime:'08:00:00',quietHoursEnabled:false,quietHoursStart:'22:00:00',quietHoursEnd:'07:00:00'};

function dashboard(currentWeightKg=80){return {greeting:'Good morning, Alex',progress:{percentComplete:4,startWeightKg:80,currentWeightKg,goalWeightKg:70,remainingKg:currentWeightKg-70,targetDate:'2026-10-20',reached:false,hasSufficientData:true,pace:{weeklyRateKg:-0.4,message:'On track'}},thisWeekChangeKg:currentWeightKg-80,averageWeeklyChangeKg:-0.4,currentStreak:1,trend:[{id:'entry-1',date:'2026-07-20',weightKg:currentWeightKg,note:'Morning check-in',updatedAt:'2026-07-20T08:00:00Z'}],celebrations:[]};}

async function mockLedger(page:Page,onboarded:boolean){
  const state={onboarded,heightCm:176,currentWeightKg:80,name:'Alex Rivera',email:'alex@example.test',preferences:{...preferences}};
  await page.route('**/api/v1/**',async(route:Route)=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path.endsWith('/auth/sign-in')||path.endsWith('/auth/refresh'))return json({accessToken:'test-token',accessTokenExpiresAt:'2099-01-01T00:00:00Z',userId:'user-1',name:'Alex Rivera',onboarded:state.onboarded});
    if(path.endsWith('/session'))return json({id:'user-1',name:'Alex Rivera',email:'alex@example.test',emailVerified:true,onboarded:state.onboarded});
    if(path.endsWith('/onboarding')&&request.method()==='GET')return json({complete:false,draft:null});
    if(path.endsWith('/onboarding')&&request.method()==='PATCH')return json({});
    if(path.endsWith('/onboarding/complete')){state.onboarded=true;return json({});}
    if(path.endsWith('/profile')&&request.method()==='GET')return json({name:state.name,email:state.email,heightCm:state.heightCm});
    if(path.endsWith('/profile')&&request.method()==='PUT'){const body=request.postDataJSON();state.name=body.name;state.email=body.email;state.heightCm=body.heightCm;return json({});}
    if(path.endsWith('/preferences')&&request.method()==='GET')return json(state.preferences);
    if(path.endsWith('/preferences')&&request.method()==='PATCH'){state.preferences={...state.preferences,...request.postDataJSON()};return json(state.preferences);}
    if(path.endsWith('/reminders')&&request.method()==='PUT'){const body=request.postDataJSON();state.preferences={...state.preferences,reminderEnabled:body.enabled,reminderTime:body.time,quietHoursEnabled:body.quietHoursEnabled,quietHoursStart:body.quietHoursStart,quietHoursEnd:body.quietHoursEnd,timeZone:body.timeZone};return json(state.preferences);}
    if(path.endsWith('/auth/change-password'))return json({});
    if(path.endsWith('/dashboard'))return json(dashboard(state.currentWeightKg));
    if(path.endsWith('/weigh-ins')&&request.method()==='POST'){state.currentWeightKg=request.postDataJSON().weightKg;return json({id:'entry-1'});}
    return json({});
  });
  return state;
}

async function openFocusedEditor(page:Page,buttonName:string|RegExp,dialogName:string){
  await page.getByRole('button',{name:buttonName}).click();
  const dialog=page.getByRole('dialog',{name:dialogName});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('.settings-grid')).toHaveCount(0);
  expect(await dialog.evaluate((element)=>element.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  return dialog;
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
  const weight=page.getByRole('textbox',{name:'Weight'});
  await expect(weight).toHaveValue('80');
  await weight.fill('79.6');
  await page.getByRole('textbox',{name:/Add a note/}).fill('Morning check-in');
  await page.getByRole('button',{name:'Save weight'}).click();
  await expect(page.getByRole('status')).toContainText('Weight logged');
  expect(state.currentWeightKg).toBe(79.6);
  await page.goto('/dashboard');
  await expect(page.getByRole('img',{name:/current weight 79.6 kg/})).toBeVisible();
});

test('all account updates use one focused, viewport-safe editor',async({context,page})=>{
  const state=await mockLedger(page,true);
  await context.addCookies([{name:'ledger_csrf',value:'test',domain:'127.0.0.1',path:'/'}]);
  await signIn(page);
  await page.getByRole('link',{name:'Profile'}).click();

  let dialog=await openFocusedEditor(page,'Edit profile','Edit profile');
  await dialog.getByRole('textbox',{name:'Name'}).fill('Alex Morgan');
  await dialog.getByRole('textbox',{name:'Email'}).fill('alex.morgan@example.test');
  await dialog.getByRole('button',{name:'Save profile'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Profile saved');
  expect(state.name).toBe('Alex Morgan');

  dialog=await openFocusedEditor(page,/Height 176 cm/,'Edit height');
  await dialog.getByRole('button',{name:'Close'}).click();

  dialog=await openFocusedEditor(page,'Change password','Change password');
  await dialog.getByLabel('Current password').fill('Aurora123!');
  await dialog.locator('input[formcontrolname="newPassword"]').fill('Fresh-password1!');
  await dialog.locator('input[formcontrolname="confirmPassword"]').fill('Fresh-password1!');
  await dialog.getByRole('button',{name:'Save password'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Password changed');

  dialog=await openFocusedEditor(page,'Appearance & units','Appearance & units');
  await dialog.getByLabel('Weight unit').selectOption('Lbs');
  await dialog.getByLabel('Theme').selectOption('Dark');
  await dialog.getByLabel('Week starts on').selectOption('Sunday');
  await dialog.getByRole('button',{name:'Save preferences'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Preferences saved');
  expect(state.preferences.unit).toBe('Lbs');

  dialog=await openFocusedEditor(page,'Reminders','Reminders');
  await dialog.getByRole('checkbox',{name:'Daily reminder'}).check();
  await dialog.getByLabel('Reminder time').fill('09:15');
  await dialog.getByRole('button',{name:'Save reminders'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Reminders saved');
  expect(state.preferences.reminderEnabled).toBe(true);
  expect(state.preferences.reminderTime).toBe('09:15:00');

  dialog=await openFocusedEditor(page,'Data & privacy','Data & privacy');
  await dialog.getByRole('button',{name:'Close'}).click();

  dialog=await openFocusedEditor(page,'Sign out','Sign out');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(dialog).toBeHidden();
});
