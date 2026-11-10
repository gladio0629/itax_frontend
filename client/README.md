# IZGO Client

Passenger-facing mobile web app (rendered inside a phone frame for desktop preview). Port 5173.

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build
npm run check:no-network
```

## Demo login

Phone screen accepts any valid Uzbek phone number. The OTP code is always **0000** in demo mode.

## Key flows

- Home → choose origin/destination → order (regular or "Butun mashina")
- Order matching → driver found → live trip tracking (static local SVG map)
- Wallet top-up and card linking both use the shared "submitForReview" pattern
  (`Tekshiruvga yuborildi` → auto-approves in 2–4s)
- Trip history, ratings, profile, notifications

Use the floating **DEMO** pill (bottom-right; it doubles as the demo badge) to open the Demo
Control Panel: reset the database or simulate "no driver found", slow internet, forced errors,
or fast-forwarded time. On a full-screen phone the pill steps aside so it never covers the app:
it hides while a sheet, the drawer or the expanded order flow is open, sits just above any
bottom bar or the home sheet, and scroll areas reserve room so their last item clears it.
