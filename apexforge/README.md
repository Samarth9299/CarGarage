# ApexForge — Local Development

## Run Locally (3 ways)

### Method 1: Python (recommended, no install needed)
```bash
# Navigate to the apexforge folder
cd apexforge

# Python 3
python3 -m http.server 8080

# Python 2 (older systems)
python -m SimpleHTTPServer 8080
```
Open: http://localhost:8080

---

### Method 2: Node.js live-server
```bash
npm install -g live-server
cd apexforge
live-server --port=8080
```
This automatically reloads on file changes.

---

### Method 3: VS Code — Live Server Extension
1. Install "Live Server" extension by Ritwick Dey
2. Right-click `index.html` → "Open with Live Server"

---

## Project Structure

```
apexforge/
├── index.html              ← Home page (particle hero, quick-start form)
├── performance.html        ← Performance Lab (dyno, mods, sprint sim)
├── aesthetic.html          ← Aesthetic Studio (3D config, paint, before/after)
├── garage.html             ← Digital Garage (build saves via localStorage)
├── recommendations.html    ← Smart Recommendations wizard
├── community.html          ← Community feed with like/filter
├── knowledge.html          ← Knowledge base articles
├── legal.html              ← Legal & compliance notes
├── nginx.conf              ← Nginx config for production
├── AWS-DEPLOY.md           ← Full AWS deployment guide
└── assets/
    ├── styles.css          ← All styles (Orbitron/Rajdhani fonts, 3D effects)
    ├── app.js              ← Core: theme, drawer, toast, command palette
    ├── data.js             ← Vehicle & mod dataset + dyno curves
    ├── ui.js               ← Vehicle picker component
    ├── home.js             ← Home page: vehicle form, build creation
    ├── perf.js             ← Performance math: sprint estimates
    ├── performance.js      ← Performance Lab: mod toggles, dyno chart
    ├── aesthetic.js        ← Aesthetic Studio: 3D viewer, paint swatches
    ├── garage.js           ← Digital Garage: localStorage build CRUD
    ├── recommendations.js  ← Recommendation wizard
    ├── community.js        ← Community feed
    └── images/
        ├── before.svg      ← Stock car silhouette (before/after slider)
        └── after.svg       ← Modified car silhouette (before/after slider)
```

## Pages & Features

| Page | Features |
|------|---------|
| Home | Animated particle canvas, live demo dyno preview, quick-start vehicle form |
| Performance Lab | 15+ mod toggles, real-time animated dyno chart, sprint simulation |
| Aesthetic Studio | CSS 3D rotating car, 20 paint swatches, drag before/after slider |
| Digital Garage | localStorage build save/edit/delete with modal UI |
| Recommendations | 3-step wizard → Stage 1/2/3 build paths |
| Community | Filterable feed with like toggling |
| Knowledge Base | Expandable technical articles |
