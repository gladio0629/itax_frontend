# IZGO Driver

Driver-facing mobile web app, dark/night mode by default. Port 5174.

```bash
npm install
npm run dev          # http://localhost:5174
npm run typecheck
npm run build
npm run check:no-network
```

## Demo login

The driver is always considered logged in for this demo (no login screen) — the app opens
straight to the home/dispatch screen for a seeded demo driver.

## Key flows

- Online/offline toggle, incoming order requests with accept/decline
- Active trip screen with live-animated route (static local SVG map + simulated progress)
- Wallet balance, earnings, commission history
- Document upload / re-verification uses the shared "submitForReview" pattern
- Stats screen with recharts-based weekly earnings chart

Use the floating Demo Control Panel (bottom-right) to reset the database or simulate
"no driver found", slow internet, forced errors, wallet limit, or fast-forwarded time.
