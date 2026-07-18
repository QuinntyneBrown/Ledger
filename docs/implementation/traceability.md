# Implementation traceability

Every executable acceptance test includes a `Traces to: L2-xxx` comment. Coverage is grouped as follows:

| Requirements | Implementation and acceptance coverage |
|---|---|
| `L2-001`–`L2-009` | Identity handlers and `/api/v1/auth`; registration, reset, member-journey integration, and auth UI tests |
| `L2-010`–`L2-012` | Resumable onboarding, baseline creation, route guards, and member-journey test |
| `L2-013`–`L2-020` | Weigh-in handlers and log/history surfaces; member journey and keyboard journey |
| `L2-021`–`L2-024` | Direction-neutral goal math and 28-day projection; domain tests and member journey |
| `L2-025`–`L2-033` | Indexed trend/history queries, moving average and paging; member journey and responsive UI |
| `L2-034`–`L2-037` | Monotonic badge catalog, acknowledgement, and streak calculator; domain and journey tests |
| `L2-038`–`L2-041` | Dashboard read model and nominal/loading/error UI; journey and component tests |
| `L2-042`–`L2-054` | Profile/avatar, preferences, reminders, CSV, data erasure, and account deletion |
| `L2-055`–`L2-056` | SignalR groups, Redis backplane, timestamps, sync feed, and reconciliation client |
| `L2-057`–`L2-062` | Prerendered marketing, consent, SEO/crawler assets, legal drafts, and public UI test |
| `L2-063`–`L2-066` | Aurora components, adaptive shell, token motion, and component/UI tests |
| `L2-067`–`L2-073` | Owner scoping, validation, secure cookies, CSRF, throttling, audit, and headers |
| `L2-074`–`L2-077` | Bounded reads, lazy chunks, Docker scale boundary, Redis, and 30-day retention |
| `L2-078`–`L2-081` | Landmarks, focus, keyboard controls, chart descriptions, contrast, reduced motion |
| `L2-082`–`L2-084` | JSON logs, correlation traces, health, metrics, OTLP, and error states |
| `L2-085`–`L2-089` | Clean projects, Angular libraries, ATDD comments, ProblemDetails, and EF migration |
