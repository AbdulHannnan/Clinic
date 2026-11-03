# Features

Each folder is one business feature and owns its components, hooks and API calls.
Pages in `src/app` stay thin and compose features.

| Folder | What it covers | Status |
|---|---|---|
| `queue/` | Live queue, now serving, patients ahead, wait estimate | started |
| `booking/` | Online booking, payment choice, booking confirmation | planned |
| `reception/` | Walk-ins, emergencies, arrivals, no-shows, follow-up calls | planned |
| `consultation/` | Doctor's room: history (view only), quick notes, medicines, Done | planned |
| `prescription/` | One-page printable prescription, WhatsApp share | planned |
| `finance/` | Collections, discounts, refunds, daily and 7-day summary | planned |
| `treatment-plans/` | Long-term plans and automatic check-up reminders | planned |

Suggested layout inside a feature:

```
feature-name/
  components/   UI for this feature only
  hooks/        client state and realtime subscriptions
  api.ts        calls to the backend
```
