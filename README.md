# RescueGrid AI

**The fastest way to turn chaos into life-saving field action.**

RescueGrid AI is a crisis-response copilot that transforms chaotic real-world signals — voice notes, photos, news links, weather alerts, and text messages — into structured, verified, life-saving field actions. Powered by Google Gemini, Google Maps Platform, and deployed on Google Cloud Run.

---

## Features

- **Multimodal Input** — Text reports, photo evidence, voice recordings (with Google Speech-to-Text), news URLs, and GPS location
- **AI-Powered Analysis** — Gemini classifies incidents, assesses severity, and generates action checklists for citizens, responders, and city operations
- **Google Search Grounding** — Facts are verified against live search results before reporting
- **Function Calling** — Gemini autonomously searches for hospitals, shelters, evacuation routes, and weather conditions
- **Interactive Crisis Map** — Google Maps with dark theme, incident zone overlays, and resource markers
- **Multilingual TTS Alerts** — Generate spoken emergency alerts in 14 languages via Google Cloud Text-to-Speech
- **Real-Time Weather** — Hyperlocal weather conditions from Google Weather API
- **Traffic-Aware Routing** — Evacuation and responder routes via Google Routes API

## Google Services Used

| Service | Purpose |
|---------|---------|
| **Gemini (Google Gen AI)** | Structured incident analysis with function calling |
| **Google Search Grounding** | Verify claims against live news and advisories |
| **Google Maps JavaScript API** | Interactive crisis map with advanced markers |
| **Google Places API (New)** | Find nearby hospitals, shelters, fire stations |
| **Google Routes API** | Traffic-aware evacuation and responder routing |
| **Google Weather API** | Hyperlocal weather risk assessment |
| **Google Cloud Text-to-Speech** | Multilingual emergency alert audio |
| **Google Cloud Speech-to-Text** | Voice note transcription |
| **Google Cloud Run** | Serverless production deployment |
| **Google Cloud Build** | CI/CD container builds |
| **Google Artifact Registry** | Container image storage |
| **Google Secret Manager** | Secure API key management |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App (Cloud Run)                 │
├──────────────┬──────────────────────────────────────────────┤
│  React UI    │  API Routes (Server-Side)                    │
│  ┌─────────┐ │  ┌───────────────┐  ┌────────────────────┐  │
│  │ Input   │ │  │ /api/analyze  │──│ Gemini + Grounding │  │
│  │ Panel   │ │  │               │  │ + Function Calling │  │
│  ├─────────┤ │  ├───────────────┤  ├────────────────────┤  │
│  │ Map     │ │  │ /api/alert    │──│ Cloud TTS          │  │
│  │ View    │ │  ├───────────────┤  ├────────────────────┤  │
│  ├─────────┤ │  │/api/transcribe│──│ Cloud STT          │  │
│  │ Results │ │  ├───────────────┤  ├────────────────────┤  │
│  │ Panel   │ │  │ /api/weather  │──│ Weather API        │  │
│  └─────────┘ │  │ /api/places   │──│ Places API         │  │
│              │  │ /api/route    │──│ Routes API         │  │
│              │  │ /api/health   │  │ (health check)     │  │
│              │  └───────────────┘  └────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
```

## Tech Stack

- **Framework:** Next.js 16 (App Router, Standalone output)
- **Language:** TypeScript 5.9 (strict mode)
- **UI:** React 19, CSS custom properties, dark-mode-first design
- **AI:** Google Gen AI SDK (`@google/genai`)
- **Validation:** Zod 4
- **Testing:** Jest 30 (unit) + Playwright (e2e + accessibility)
- **Linting:** ESLint with Next.js + TypeScript rules
- **Deployment:** Docker multi-stage build → Google Cloud Run

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project with the following APIs enabled:
  - Generative Language API (Gemini)
  - Maps JavaScript API
  - Places API (New)
  - Routes API
  - Weather API
  - Cloud Text-to-Speech API
  - Cloud Speech-to-Text API

### Installation

```bash
git clone https://github.com/jithujj153/RescuerGridAI.git
cd RescuerGridAI
npm install
```

### Configuration

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps API key (client-side, embedded at build) |
| `GOOGLE_MAPS_API_KEY` | Maps API key (server-side, stays secret) |
| `GOOGLE_CLOUD_PROJECT_ID` | Your GCP project ID |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app |

### Development

```bash
npm run dev          # Start dev server on :3000
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run unit tests (Jest)
npm run test:e2e     # Run e2e tests (Playwright)
```

### Build & Run Locally

```bash
npm run build
npm start
```

## Deployment to Google Cloud Run

### Prerequisites

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Create secrets in Secret Manager:
   ```bash
   echo -n "YOUR_GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
   echo -n "YOUR_MAPS_KEY" | gcloud secrets create maps-api-key --data-file=-
   echo -n "YOUR_PROJECT_ID" | gcloud secrets create gcp-project-id --data-file=-
   ```

### Deploy

```bash
export GCP_PROJECT_ID=your-project-id
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
export NEXT_PUBLIC_APP_URL=https://rescuegrid-ai-xxxxx.run.app
bash deploy.sh
```

The deploy script will:
1. Enable required GCP APIs
2. Create an Artifact Registry repository
3. Build the container via Cloud Build (with `NEXT_PUBLIC_*` build args)
4. Deploy to Cloud Run with secrets from Secret Manager

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/     # Gemini multimodal incident analysis
│   │   ├── alert/       # Google Cloud TTS alert generation
│   │   ├── transcribe/  # Google Cloud STT voice transcription
│   │   ├── weather/     # Google Weather API conditions
│   │   ├── places/      # Google Places API (hospitals, shelters)
│   │   ├── route-plan/  # Google Routes API evacuation routing
│   │   └── health/      # Health check for Cloud Run
│   ├── layout.tsx       # Root layout with metadata + a11y
│   ├── page.tsx         # Dashboard page (single-page app)
│   └── globals.css      # Design system (WCAG 2.1 AA)
├── components/
│   ├── Header.tsx       # App header with status indicator
│   ├── InputPanel.tsx   # Multimodal input (text, photo, voice, URLs)
│   ├── MapView.tsx      # Google Maps with incident overlays
│   ├── IncidentCard.tsx # Analysis results display
│   ├── ActionChecklist.tsx  # Tabbed action items by audience
│   └── AlertGenerator.tsx   # TTS alert with multilingual support
├── lib/
│   ├── ai/              # Gemini client, prompts, function handlers
│   ├── maps/            # Google Maps Platform API clients
│   ├── schemas/         # Zod validation schemas
│   ├── types/           # TypeScript type definitions
│   ├── logger.ts        # Structured JSON logging
│   └── rate-limit.ts    # In-memory rate limiter
├── __tests__/           # Jest unit tests
e2e/                     # Playwright e2e + accessibility tests
```

## Security

- Rate limiting on all API endpoints
- Content Security Policy (CSP) headers
- HSTS, X-Frame-Options, X-Content-Type-Options
- Zod input validation on all endpoints
- Server-side API keys (not exposed to client)
- Non-root Docker user
- Error messages sanitized in production
- Google Secret Manager for credential storage

## Testing

- **Unit Tests (Jest):** Schema validation, rate limiting, logging, function handlers, health check
- **E2E Tests (Playwright):** Dashboard interactions, form behavior, keyboard navigation
- **Accessibility Tests (axe-core):** WCAG 2.1 AA compliance, ARIA roles, keyboard accessibility

## License

MIT
