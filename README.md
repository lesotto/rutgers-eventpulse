# Rutgers EventPulse — Scarlet Knights Football

A FuzeBox EventPulse demonstration for Rutgers Football: a hyper-personalized fan companion that runs the whole 2026 season.

**Live site:** https://lesotto.github.io/rutgers-eventpulse/

## What's inside
- **My Season** — all 12 games (7 home at SHI Stadium, 5 away) with a personal itinerary for each, rebuilt from ticket section, arrival mode, kids, first-visit and student settings. Save games and export to calendar (.ics).
- **SHI Map** — satellite 3D map of SHI Stadium with gates (A/B, C/D, E/F, G/H), Boardwalk, food, lots, shuttles and rideshare; distance, route line and one-tap Google Maps handoff.
- **Watch Parties** — every official Rutgers alumni watch-party site on a US map, Nebraska-specific list, Off the Banks away-game events, nearest-to-me and directions.
- **QR Check-In** — real, scannable QR codes per location (`?checkin=<id>`). Scanning opens the site, records the check-in, unlocks a gift, advances the itinerary and opens a two-way alumni thread.
- **Athletics & Alumni Console** — live fan-signal view (simulated stream plus real check-ins from this browser), outreach queue with staff approval, and fan replies.
- **Videos** — five 8-second AI concept clips: sports-bar watch-party check-in and four SHI Stadium QR flyovers.
- **Henry** — built-in game-day concierge (rule-based, grounded in official Rutgers pages).

## Run locally
```bash
python3 -m http.server 5173   # open http://localhost:5173/
```
Static site, no build step, no backend.

## Data & disclaimers
Schedule, results, policies and watch-party locations come from scarletknights.com, alumni.rutgers.edu and ESPN (linked in-app). Some pins are approximate. Console data, outreach messages and gifts are simulated; check-ins and replies are stored only in the visitor's browser. Videos are AI concept footage. Not affiliated with or endorsed by Rutgers University. Imagery © Esri; map data © OpenStreetMap contributors.
