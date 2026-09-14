# Koodam (കൂടം) — Production Backend

> **Tagline:** Meet • Explore • Belong (Discover Events. Meet People. Find Your Connection.)  
> **Platform Target:** Enterprise Cloud Backend built with **Node.js (NestJS 10+ / TypeScript)**  
> **Database & Spatial Engine:** **PostgreSQL 16+** with **PostGIS** spatial indexing + **Redis 7+**  
> **Real-Time Layer:** **Socket.io** with Redis Streams Adapter  
> **Target Audience:** All 14 districts of Kerala (Kochi, Kozhikode, Thiruvananthapuram, Thrissur, etc.) and global Malayali diaspora (Dubai, Doha, London, Bengaluru, Singapore, etc.)

---

## 1. System Architecture & High-Level Topology

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FLUTTER MOBILE CLIENT (iOS / Android)                │
│  - Clean Architecture (Feature-First) + Riverpod 2.5+                  │
│  - Interactive Live Radar Map with custom vector styling               │
│  - Real-time: socket_io_client with automatic reconnect & room sync    │
└───────────────────────────────▲────────────────────────────────────────┘
                                │ HTTPS / WSS
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│               NODE.JS / NESTJS MODULAR BACKEND API                     │
│  - Framework: NestJS (Express / Fastify adapter) + TypeScript (strict) │
│  - Security: Helmet, rate-limit, Passport JWT, WhatsApp Business OTP   │
│  - Real-Time Gateway: @nestjs/websockets with Socket.io Redis Streams  │
│  - Background Jobs: BullMQ / Redis for 48h Love expiry & vouch checks  │
│  - ORM: Prisma ORM (with PostGIS raw extensions)                       │
│  - Serverless Ready: Native Vercel Serverless Function adapter         │
└───────────────────────────────▲────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     POSTGRESQL 16 + POSTGIS   │       │           REDIS 7+            │
│  - Spatial indexes (GIST)     │       │  - GEOSEARCH radius caching   │
│  - Users, Events, Vouches     │       │  - Token blacklist & sessions │
│  - Dual Connections, RSVPs    │       │  - Real-time presence pulse   │
│  - End-to-end encrypted chat  │       │  - Distributed mutex locks    │
└───────────────────────────────┘       └───────────────────────────────┘
```

---

## 2. Core Architectural Pillars & Business Rules

### A. Strict Single-Day Policy
- Events are strictly locked to a single calendar date (`event_date`).
- Maximum duration is **8 hours (480 minutes)**.
- Start time and end time validation prevents multi-day ambiguity.
- Supports both `CASUAL_MEETUP` (coffee hangouts, turf football, jamming) and `CURATED_EVENT` (screenings, workshops).

### B. 3-Peer Trust Engine
- User-created gatherings are initially staged in `PENDING_VOUCH`.
- The host generates a tokenized WhatsApp deep link (`https://koodam.app/vouch/:vouchToken`).
- Once 3 verified members vouch for the meetup:
  1. The backend increments `vouches_count` and marks the event `PUBLISHED`.
  2. The gathering is ingested into Redis Geospatial Index (`koodam:events:geo`) for instant Map Radar queries.
  3. The host’s `peer_vouch_score` is boosted.

### C. 50:50 Gender Balance Equilibrium & QR Passes
- Gatherings have an optional `gender_balance_enforced` toggle.
- When enabled, male and female reservations are strictly capped at 50% capacity using database row locks to prevent race conditions.
- Confirmed attendees receive a unique QR Pass code (`KD-XXXX`) that hosts can scan and verify at the venue entrance.

### D. Dual-Track Social Discovery
- **"Connect"**: Platonic companion / activity friend handshake.
- **"Send Love"**: Intentional romantic interest with an optional **140-character contextual note**.
- Features an automated **48-hour TTL expiration**; unreciprocated requests expire cleanly.
- Mutual acceptance immediately creates an active `Connection` and unlocks 1:1 private chat.

### E. Ghost Privacy Guard (~400m - 900m Centroid Obfuscation)
- Precise raw GPS coordinates are internal-only and NEVER serialised over public APIs.
- Public spatial radar queries return an obfuscated neighborhood centroid (~400m - 900m randomized bearing) to guarantee female safety and privacy.
- Support for **Private Mode**: users can participate in events without appearing on public people discovery or maps.

### F. Kerala Location Hierarchy
- Pre-seeded with all **14 districts of Kerala**:
  - Thiruvananthapuram, Kollam, Pathanamthitta, Alappuzha, Kottayam, Idukki, Ernakulam, Thrissur, Palakkad, Malappuram, Kozhikode, Wayanad, Kannur, Kasaragod.
- Top cities and local areas (Kochi, Fort Kochi, Panampilly Nagar, Kozhikode Beach, etc.).
- Global diaspora hubs (Dubai, Abu Dhabi, Doha, London, Bengaluru, Singapore).
- Separate `current_location` vs `exploring_location` (e.g. an NRI physically in Dubai exploring Kochi).

---

## 3. Directory Structure

```text
src/
├── app.module.ts              # Main NestJS dependency root
├── main.ts                    # Bootstrap with Helmet, CORS, Swagger & Socket.io
├── common/
│   ├── decorators/            # CurrentUser, Roles, Public, Throttle decorators
│   ├── dto/                   # Standard ApiResponse, PaginationDto, GeoDto
│   ├── filters/               # AllExceptionsFilter with RFC-7807 error format
│   ├── guards/                # JwtAuthGuard, RolesGuard, WsJwtGuard
│   ├── interceptors/          # LoggingInterceptor, TransformResponseInterceptor
│   └── utils/                 # app.exception, date.util, geo.util, code.util
├── config/                    # Environment validation and typed configurations
├── database/                  # PrismaService, RedisService, SpatialService (PostGIS)
└── modules/
    ├── auth/                  # Phone/Email authentication, OTP, JWT refresh rotation
    ├── users/                 # Profile photos (max 6), interests, device tokens, delete
    ├── profiles/              # Onboarding, age calculation, ghost privacy coordinates
    ├── blocks/                # Bidirectional blocking cascade
    ├── privacy/               # Private Mode, showInDiscover, distance toggle
    ├── locations/             # 14 Kerala districts, diaspora hubs, reverse geocoding
    ├── events/                # Single-day creation, spatial radar, categories
    ├── event-attendees/       # RSVP, 50:50 gender lock, QR pass (#KD-XXXX), check-in
    ├── vouches/               # 3-Peer Trust Engine, deep link verification
    ├── love-requests/         # Send Love (140 char note, 48h TTL cron, accept/decline)
    ├── connections/           # Dual-track connections list, friend handshakes
    ├── dating/                # Scored dating discovery feed (interests + intentions + roots)
    ├── messages/              # 1:1 conversation history, Malayali cultural icebreakers
    ├── realtime/              # WebSockets gateway with Socket.io Redis adapter
    ├── event-chat/            # Event community rooms, host announcements
    ├── notifications/         # Notification feeds, FCM/APNs push abstraction
    ├── search/                # Unified search across gatherings, people, locations
    ├── recommendations/       # Modular recommendation engine (rule-based + AI ready)
    ├── featured-events/       # 1-day, 7-day, 30-day promotional tiers
    ├── payments/              # PaymentProvider abstraction (Mock, Razorpay, Stripe)
    ├── media/                 # Presigned secure upload URLs
    ├── reports/               # Safety & moderation reporting
    ├── verification/          # Blue tick selfie/identity verification
    ├── admin/                 # RBAC moderation panel, audit logs
    └── health/                # Liveness & readiness probes
```

---

## 4. API Endpoints Reference

### Base URL: `/api/v1`

#### Authentication (`/api/v1/auth`)
- `POST /auth/register` — Create account with email or phone + password
- `POST /auth/login` — Sign in and obtain access/refresh token pair
- `POST /auth/refresh` — Rotate refresh token (reuse revokes whole session family)
- `POST /auth/logout` — Revoke active session
- `POST /auth/otp/request` — Send WhatsApp / SMS OTP verification code
- `POST /auth/otp/verify` — Verify one-time code
- `GET /auth/me` — Current authenticated user identity and onboarding status

#### Profiles & Privacy (`/api/v1/profiles` & `/api/v1/privacy`)
- `GET /profiles/me` — Complete private profile with location mode
- `POST /profiles/me` — Onboarding wizard profile creation (age derived from DOB)
- `PATCH /profiles/me` — Partial profile update
- `PUT /profiles/me/location` — Update device GPS (automatically ghosted with ~800m blur)
- `PUT /profiles/me/exploring-location` — Set exploring place (e.g. Dubai resident exploring Kochi)
- `GET /profiles/:userId` — Public profile with privacy rules & coarse distance
- `GET /privacy/settings` — Read privacy settings & Private Mode
- `PUT /privacy/settings` — Toggle Private Mode, distance visibility, etc.

#### Gatherings & Live Radar (`/api/v1/events`)
- `GET /events/radar?lat=9.9312&lng=76.2673&radius_km=15` — Spatial map radar query
- `POST /events` — Create gathering (Strict Single-Day validation, max 8h duration)
- `GET /events/:id` — Event details, vouches, and attendee preview
- `PUT /events/:id` — Update gathering (host only)
- `DELETE /events/:id` — Cancel gathering
- `GET /events/categories` — List all gathering categories

#### 3-Peer Trust Engine (`/api/v1/vouches`)
- `POST /vouches/submit` — Submit peer endorsement (3 vouches publish event to radar)
- `POST /vouches/verify-token` — Vouch via WhatsApp deep link token
- `GET /vouches/token/:vouchToken` — Preview gathering from shared link
- `GET /vouches/event/:eventId` — List verified peer endorsements

#### RSVPs & Passes (`/api/v1/events/:id`)
- `POST /events/:id/join` — RSVP with atomic 50:50 gender balance lock & QR pass
- `DELETE /events/:id/join` — Cancel reservation
- `POST /events/:id/save` — Bookmark gathering to My Events
- `GET /events/:id/people` — Discover confirmed attendees
- `POST /events/:id/check-in` — Host scans attendee QR pass code
- `GET /events/me/attending` — My tickets with `#KD-XXXX` pass codes
- `GET /events/me/hosting` — Gatherings hosted by current user

#### Intentional Dating & Love Requests (`/api/v1/dating` & `/api/v1/love-requests`)
- `GET /dating/discover` — Scored discovery deck (shared interests + intention + roots)
- `POST /love-requests` — Send Love Request (with 140-char note, 48h expiration)
- `GET /love-requests/received` — List incoming active Love Requests with countdown
- `POST /love-requests/:id/accept` — Accept Love (creates connection + unlocks chat)
- `POST /love-requests/:id/decline` — Decline Love Request

#### Real-Time Chat & Communities (`/api/v1/conversations`)
- `GET /conversations` — List 1:1 and event community conversations
- `GET /conversations/:id/messages` — Cursor-based message history
- `POST /conversations/:id/messages` — Send message (REST fallback)
- `PUT /conversations/:id/read` — Mark conversation as read
- `GET /conversations/icebreakers` — Curated Malayali cultural conversation starters

#### WebSocket Events (Socket.io)
- `conversation:join` — Join conversation room
- `message:send` — Broadcast real-time message
- `typing:start` / `typing:stop` — Live typing indicators
- `message:read` — Read receipt updates

---

## 5. Local Development Setup

### Prerequisites
- **Node.js 20+**
- **PostgreSQL 16+** with PostGIS extension (`CREATE EXTENSION postgis;`)
- **Redis 7+**

### Installation
```bash
# Clone the repository
git clone git@github.com:abbasalitmk/koodam.git
cd koodam

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local database and Redis credentials

# Run database migrations and seed Kerala locations & interests
npx prisma migrate dev
npm run db:seed

# Run unit tests
npm test

# Start in development mode
npm run start:dev
```

---

## 6. Vercel Deployment

This backend includes native support for **Vercel Serverless Functions** via `api/index.ts` and `vercel.json`.

### Deploying via Vercel CLI
```bash
# Deploy to preview
vercel --token <YOUR_VERCEL_TOKEN>

# Deploy to production
vercel --prod --token <YOUR_VERCEL_TOKEN>
```

### Required Environment Variables on Vercel
Configure these in your Vercel Project Settings (`Environment Variables`):
- `DATABASE_URL`: Connection string to PostgreSQL with PostGIS enabled (e.g. Supabase, Neon, AWS RDS)
- `REDIS_URL`: Redis connection URL (e.g. Upstash Redis)
- `JWT_SECRET`: 64+ char random secret for access tokens
- `JWT_REFRESH_SECRET`: 64+ char random secret for refresh tokens
- `NODE_ENV`: `production`

---

## 7. License
Proprietary & Confidential — © 2026 Koodam (കൂടം). All Rights Reserved.
