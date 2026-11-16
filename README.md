# Mangalore Property Inventory

Voice-first real-estate inventory and lead matching dashboard for Mangalore.

- `index.html` — the built app (served by Netlify)
- `src/app.template.html` — app UI and logic
- `src/parser.js` — voice/text parser for listings, searches and leads, plus lead↔listing matching
- `build.py` — run `python3 build.py` to rebuild `index.html` from `src/`

Backend: Supabase project "Real Estate Inventory" (data, auth, photos). The key in the app is the public publishable key; data access is protected by row-level security.
