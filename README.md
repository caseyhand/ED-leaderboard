# ED Physician Productivity Dashboard

Weekly productivity leaderboard for ED physicians. Built with React + Vite, deployable on Vercel.

## Features

- 📊 Weekly ranked leaderboard (sorted by Pt/hr)
- 🔒 Blinded by default — letters only, names hidden
- 🔓 Admin unblind toggle with password protection
- 📈 Multi-week trend view with per-physician charts
- 🏆 Top producer highlight + current user row
- ESI acuity breakdown with visual bars
- Admin panel: add weeks, manage name mappings, settings

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deployment (Vercel)

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

### Option B — GitHub → Vercel (recommended)
1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import from GitHub
3. Select this repo
4. Framework: **Vite** (auto-detected)
5. Click Deploy

Vercel will auto-deploy on every push to `main`.

## Admin Access

Default password: **ed2025**

To change: edit `ADMIN_PASSWORD` in `src/data.js`

Admin capabilities:
- Toggle blinded/unblinded mode
- Add new weekly data (form or JSON paste)
- Map letters to physician names
- Set your own letter identifier

## Adding Weekly Data

### Via Admin Panel (UI)
1. Click Admin → enter password
2. Go to "Add Week" tab
3. Enter week label (e.g. "Week of 5/10–5/16")
4. Fill in physician rows, or paste JSON
5. Save

### Via JSON (paste from data source)
Use this format:
```json
[
  { "letter": "H", "pts": 48, "pthr": 2.53, "esi1": 0, "esi2": 9, "esi3": 36, "esi4": 2, "esi5": 0 },
  { "letter": "R", "pts": 0,  "pthr": null, "esi1": 0, "esi2": 1, "esi3": 0,  "esi4": 0, "esi5": 0 }
]
```

## Data Storage

All data is stored in the browser's `localStorage`. This means:
- Data persists across sessions on the same device
- Each browser/device has its own data
- For shared/multi-device use, consider upgrading to Firebase (see Phase 2 roadmap)

## Project Structure

```
src/
  data.js           # Seed data + admin password
  App.jsx           # Main app, routing, admin auth
  components/
    Leaderboard.jsx  # Main ranked table
    TrendView.jsx    # Historical trend charts
    AdminPanel.jsx   # Admin: add data, names, settings
    WeekSelector.jsx # Week tab bar
```

## Roadmap

- **Phase 2:** Firebase backend for shared persistence across devices
- **Phase 3:** Per-physician detail view, email distribution
- **Phase 4:** EMR/scheduling data integration
