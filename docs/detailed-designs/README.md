# Ledger — Detailed Designs

Per-feature design documents refining the requirements in [`../specs/`](../specs/). Each feature folder holds a `README.md` (Overview, Description, Requirements, Diagrams) and a `diagrams/` folder of PlantUML sources rendered to PNG. Every feature traces to level-2 (L2) requirements, which refine level-1 (L1) requirements.

**10 subsystems · 22 features · 89 of 89 L2 requirements covered.**

Regenerate diagrams with `python <skill>/scripts/render_puml.py docs/detailed-designs`.

## Subsystems

### Identity & Access — `identity-access/`

| Feature | L2 requirements |
|---------|-----------------|
| [Manage a password](identity-access/manage-password/) | `L2-005`, `L2-006`, `L2-007` |
| [Register an account](identity-access/register-account/) | `L2-001`, `L2-002`, `L2-003`, `L2-068`, `L2-071` |
| [Sign in](identity-access/sign-in/) | `L2-004`, `L2-008`, `L2-009`, `L2-069`, `L2-072` |

### Onboarding — `onboarding/`

| Feature | L2 requirements |
|---------|-----------------|
| [Complete onboarding](onboarding/complete-onboarding/) | `L2-010`, `L2-011`, `L2-012` |

### Weight Tracking — `weight-tracking/`

| Feature | L2 requirements |
|---------|-----------------|
| [Backdate a weigh-in](weight-tracking/backdate-weigh-in/) | `L2-017` |
| [Browse weigh-in history](weight-tracking/browse-history/) | `L2-030`, `L2-031`, `L2-032`, `L2-033`, `L2-076` |
| [Edit or delete a weigh-in](weight-tracking/edit-weigh-in/) | `L2-018`, `L2-019`, `L2-067` |
| [Log a weigh-in](weight-tracking/log-weigh-in/) | `L2-013`, `L2-014`, `L2-015`, `L2-016`, `L2-020`, `L2-068`, `L2-079` |

### Goals — `goals/`

| Feature | L2 requirements |
|---------|-----------------|
| [Set a goal](goals/set-goal/) | `L2-022` |
| [Track goal progress](goals/track-goal-progress/) | `L2-021`, `L2-023`, `L2-024` |

### Insights — `insights/`

| Feature | L2 requirements |
|---------|-----------------|
| [View the dashboard](insights/view-dashboard/) | `L2-038`, `L2-039`, `L2-040`, `L2-041`, `L2-084` |
| [View trends](insights/view-trends/) | `L2-025`, `L2-026`, `L2-027`, `L2-028`, `L2-029`, `L2-076`, `L2-080` |

### Achievements — `achievements/`

| Feature | L2 requirements |
|---------|-----------------|
| [Earn badges](achievements/earn-badges/) | `L2-034`, `L2-036`, `L2-037`, `L2-081` |
| [Track streaks](achievements/track-streaks/) | `L2-035` |

### Account — `account/`

| Feature | L2 requirements |
|---------|-----------------|
| [Configure preferences](account/configure-preferences/) | `L2-045`, `L2-046`, `L2-047`, `L2-048` |
| [Export and erase data](account/export-and-erase-data/) | `L2-052`, `L2-053`, `L2-054`, `L2-070`, `L2-072` |
| [Manage profile](account/manage-profile/) | `L2-042`, `L2-043`, `L2-044` |
| [Manage reminders](account/manage-reminders/) | `L2-049`, `L2-050`, `L2-051` |

### Synchronization — `synchronization/`

| Feature | L2 requirements |
|---------|-----------------|
| [Real-time sync across devices](synchronization/realtime-sync/) | `L2-055`, `L2-056`, `L2-067`, `L2-077` |

### Marketing — `marketing/`

| Feature | L2 requirements |
|---------|-----------------|
| [Marketing site](marketing/marketing-site/) | `L2-057`, `L2-058`, `L2-059`, `L2-060`, `L2-061`, `L2-062` |

### Platform (cross-cutting) — `platform/`

| Feature | L2 requirements |
|---------|-----------------|
| [API and persistence foundation](platform/api-and-persistence-foundation/) | `L2-085`, `L2-088`, `L2-089`, `L2-074`, `L2-082`, `L2-083`, `L2-087` |
| [Web app shell](platform/web-app-shell/) | `L2-063`, `L2-064`, `L2-065`, `L2-066`, `L2-073`, `L2-075`, `L2-078`, `L2-086` |

