# Ledger visual conformance audit

- Audit date: 2026-07-19
- Reference source: `design-system` Aurora tokens/components, with the product compositions in `docs/mocks`
- Implementation: Angular application in `frontend/projects/ledger-app`

## Result

All 29 reference pages were mapped to an implemented route, state, or interaction. The shared application shell and route templates now consume the same Aurora tokens, components, icon sprite, layout stylesheet, responsive breakpoints, and state patterns as the reference gallery. No open visual-conformance gaps remain in the audited desktop (1440 × 1000) and mobile (390 × 844) viewports.

The mock gallery contains several state variants rather than separate product routes. Those variants are implemented through loading, empty, error, dialog, toast, edit, and celebration states on the owning route.

## Screen-by-screen coverage

| Reference | Implemented route/state | Baseline gap | Resolution |
|---|---|---|---|
| `dashboard/dashboard.html` | `/dashboard` populated | Generic card layout, percentage-only ring, no reference header/rail, no milestone card | Aurora 248 px current-weight gauge, date/avatar header, pace chips, three mini-stats, trend snapshot, next milestone, responsive reference shell |
| `dashboard/empty.html` | `/dashboard` with no trend entries | No dashboard zero state | Action-led empty state links directly to Log weight |
| `dashboard/loading.html` | `/dashboard` while fetching | Skeletons did not use reference proportions | Dashboard hero and stat skeleton state retained in the reference layout |
| `dashboard/celebration.html` | `/dashboard` when goal is reached | Goal completion had no celebration | Modal celebration with trophy treatment and explicit dismissal |
| `weigh-in/log.html` | `/log` for today | Form-card presentation differed from centered weigh-in pad | Reference header, date context, large stepper, unit, optional note, primary save action and sync caption |
| `weigh-in/backdate.html` | `/log` with a past date | Past-date entry was visually indistinguishable | Date control and `Past entry` context switch support backdating in the same responsive flow |
| `weigh-in/edit.html` | `/history` inline edit | Edit existed but used generic controls | Aurora icon action and styled inline editor with Save/Cancel actions |
| `goal/goal.html` | `/goal` summary mode | Summary and edit form were merged; gauge and progress hierarchy differed | Dedicated summary mode with gauge, chips, progress card, pace banner and edit action |
| `goal/edit-goal.html` | `/goal` edit mode | No distinct edit state; target date was not repopulated | Dedicated editor mode, centered goal input, calendar field, Cancel/Save; target date now loads correctly |
| `trends/trends.html` | `/trends` populated | Plain polyline, generic tabs and cards | Aurora segmented ranges, responsive area/range/moving-average chart, goal line, legend, four trend stats and recent entries |
| `trends/log-history.html` | `/history` | Header, sort and row actions diverged | Reference record header, compact grouped ledger rows, chronological deltas, filter sheet and inline edit/delete actions |
| `trends/empty.html` | `/trends` with fewer than two entries | Minimal generic message | Action-oriented empty trend state remains in the chart flow |
| `milestones/milestones.html` | `/badges` | Flat badge grid only | Milestone header, streak card, next-badge progress, earned/locked collection states |
| `milestones/celebration.html` | `/badges` pending celebration | New badges were acknowledged silently on load | Pending badge remains visible in an Aurora celebration dialog until the user dismisses it |
| `onboarding/welcome.html` | `/welcome` | Welcome screen did not exist | Added focused welcome route with brand, gauge artwork, reference headline and primary action |
| `onboarding/wizard.html` | `/onboarding` steps 1–4 | Large generic card, radio rows and mismatched hierarchy | Focused four-step flow, segmented progress, segmented Kg/Lbs selector, big-number steps, clear step-specific copy and recoverable error banner |
| `onboarding/profile.html` | `/onboarding/profile` | Final profile step did not exist | Added avatar, name, optional height, photo upload, skip and finish actions |
| `auth/login.html` | `/sign-in` | Circular text logo, generic inputs and missing social section | Aurora mark, icon inputs, aligned recovery link, inline errors, primary action, social section and account link |
| `auth/sign-up.html` | `/register` | Generic form and weak visual feedback | Aurora field wrappers, password reveal/hint, branded checkbox, success banner and matching hierarchy |
| `auth/forgot-password.html` | `/forgot-password` | Generic reset card | Reference mark, email field, mail action, success feedback and back link |
| `auth/reset-password.html` | `/reset-password` | Missing confirmation field and expired-link treatment | Added confirmation/match state, error banner, fresh-link action and success state |
| `auth/verify-email.html` | Registration success and `/verify-email` | Verification feedback was a plain checkmark card | Aurora mail/verification empty-state artwork, explanatory copy and primary continuation |
| `settings/settings.html` | `/account` preferences overview | Settings were exposed as a dense form grid | Reference grouped preference/account rows with icons, values, descriptions and progressive disclosure |
| `settings/account.html` | `/account` profile overview | Profile was only an edit form | Profile hero, avatar/photo action, identity, unit/height chips and journey stats |
| `settings/change-password.html` | `/account` expanded edit controls | Security form lacked surrounding reference context | Security is grouped under account overview and expands into the styled password form |
| `states/dialogs.html` | History delete, quick weigh-in, celebrations | Destructive history action had no confirmation; quick action used bespoke sheet | Aurora alert dialog, sheet scrim, centered desktop sheet and mobile bottom sheet patterns |
| `states/toasts.html` | Log undo, account saves, auth provider feedback | Toast treatment and placement differed | Aurora-colored raised toast placement with action/status semantics |
| `states/errors.html` | Auth, onboarding, dashboard, log, goal | Inconsistent plain red text | Field help for local validation and banners/empty error panels for recoverable request failures |
| `states/empty-states.html` | Dashboard, trends, history and loading states | Generic star empty state and mismatched loading hierarchy | Context-specific zero-state copy/actions plus calm skeleton loading treatment |

## Shared gaps resolved

- Replaced the 220 px bespoke desktop navigation with the reference 264 px Aurora rail and reference mobile bottom navigation/FAB.
- Loaded the canonical `design-system/assets/tokens.css`, `components.css`, and Aurora runtime; product-only compositions come from `docs/mocks/assets/app.css`.
- Replaced Unicode navigation/action symbols with the reference SVG icon system.
- Aligned canvas, glass headers, card surfaces, borders, radii, typography, spacing, focus treatment, motion, and responsive breakpoints.
- Added focused-flow shell behavior so welcome/onboarding/profile setup do not display application navigation.
- Added missing route/state coverage for welcome, final profile setup, goal edit, goal celebration, badge celebration, deletion confirmation, registration verification feedback, and password confirmation.
- Preserved keyboard focus styles, labels, live status/error semantics, reduced-motion behavior, and modal roles.

## Verification

- Production Angular build: passed.
- Frontend unit tests: 9 passed.
- Backend solution tests: 25 passed (12 unit, 8 CLI and 5 integration).
- Visual browser pass: authenticated and public routes captured at 1440 × 1000 and 390 × 844 against the live local API.
- Audited populated, loading, empty, edit, error, modal, toast, celebration, desktop rail, and mobile bottom-navigation states.
- Completed the four-step onboarding flow with Kilograms selected and confirmed it routes successfully to the dashboard with no failed requests.
- Interaction/accessibility scan: no browser failures and no unnamed interactive controls across dashboard, log, history, trends, goal, badges, and account.

OAuth provider buttons match the visual reference and give explicit in-app feedback that provider configuration is unavailable; they do not pretend to complete an external authentication flow that the backend does not support.
