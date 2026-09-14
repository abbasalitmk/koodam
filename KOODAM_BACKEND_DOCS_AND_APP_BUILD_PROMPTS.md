# Koodam (കൂടം) — Complete Backend Documentation & Mobile App Build Prompts

> **Tagline:** Meet • Explore • Belong (Discover Events. Meet People. Find Your Connection.)  
> **Platform Target:** Enterprise Cloud Backend (Node.js / NestJS / PostGIS / Redis) + Mobile Native App (Flutter / Dart 3.x)  
> **Live Production API:** [https://koodam-mu.vercel.app](https://koodam-mu.vercel.app)  
> **Interactive Swagger UI:** [https://koodam-mu.vercel.app/api/docs](https://koodam-mu.vercel.app/api/docs)  
> **Liveness Health Check:** [https://koodam-mu.vercel.app/health/live](https://koodam-mu.vercel.app/health/live)  
> **Backend Git Repository:** [git@github.com:abbasalitmk/koodam.git](https://github.com/abbasalitmk/koodam)  
> **Mobile App Git Repository:** [git@github.com:abbasalitmk/koodam_app.git](https://github.com/abbasalitmk/koodam_app)

---

# PART I: COMPLETE BACKEND DOCUMENTATION

## 1. System Topology & Architectural Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Koodam Flutter Mobile Client (iOS / Android)         │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTPS REST (v1)                 │ WSS (Socket.io)
                   ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│           Vercel Serverless Cloud Edge / Node.js 24.x Runtime          │
│                      Cached NestJS Express App                         │
├────────────────────────────────────────────────────────────────────────┤
│ • Security: Helmet, Strict CORS, Argon2 Hashing, JWT Rotation Families │
│ • Validation: Global ValidationPipe (whitelist, transform)             │
│ • Spatial Engine: PostGIS ST_DWithin + ST_Distance Coarse Obfuscation  │
│ • Rate Limiter: ThrottlerGuard (120 req / 60s per IP/User)             │
└──────────────┬─────────────────────────────┬───────────────────────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────────┐ ┌──────────────────────────────────────┐
│  PostgreSQL 16 + PostGIS     │ │  Redis 7+ (In-Memory Pub/Sub)        │
│  Prisma ORM (GIST Indexes)   │ │  • Geospatial Hash (koodam:events)   │
│  • Users, Profiles, Photos   │ │  • Active Token Blacklist & Sessions │
│  • Single-Day Events         │ │  • WebSocket Gateway Adapter Cluster │
│  • Attendees (50:50 lock)    │ │  • Real-Time Presence & Typing Cache │
│  • 3-Peer Vouches, Matches   │ └──────────────────────────────────────┘
└──────────────────────────────┘
```

---

## 2. Global Conventions & Protocols

### 2.1 Unified JSON Response Envelope
Every endpoint in the Koodam backend strictly wraps responses in a predictable JSON envelope.

#### Standard Success (`HTTP 200 / 201`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "nextCursor": "string | null",
    "total": 42
  }
}
```

#### Standard Error (`HTTP 4xx / 5xx`)
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "The verification code is incorrect or expired.",
    "details": {
      "fields": ["code must be 6 digits"]
    }
  }
}
```

### 2.2 Error Codes Reference
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| 400 | `VALIDATION_FAILED` | Request payload fails DTO class-validator constraints. |
| 401 | `UNAUTHORIZED` / `AUTH_TOKEN_EXPIRED` | Bearer token is missing, corrupted, or expired. |
| 403 | `FORBIDDEN` | Caller lacks permissions or role (e.g. non-admin, blocked user). |
| 404 | `NOT_FOUND` | Entity (event, user, vouch, connection) does not exist. |
| 409 | `CONFLICT` / `CAPACITY_EXCEEDED` | Unique constraint violation or event spots filled. |
| 422 | `SINGLE_DAY_VIOLATION` | Event exceeds 8 hours or spans multiple calendar days. |
| 429 | `RATE_LIMITED` | Throttler limit (120 requests/minute) exceeded. |
| 500 | `INTERNAL_ERROR` | Unexpected internal server exception. |

### 2.3 Ghost Centroid Privacy Engine
To protect Malayali users against stalking or triangulation:
1. When a user submits coordinates via `POST /api/v1/profiles/me/location`, the server never persists the exact pin to discovery feeds.
2. A random Gaussian angle $\theta \in [0, 2\pi)$ and distance $r \in [400\text{m}, 900\text{m}]$ are calculated:
   $$\Delta \text{lat} = \frac{r \cos(\theta)}{111320}, \quad \Delta \text{lon} = \frac{r \sin(\theta)}{111320 \cdot \cos(\text{lat})}$$
3. All discovery queries compute distance relative to this blurred Ghost Centroid, and round distances to coarse increments (e.g. `4.8 km`).

---

## 3. Kerala District & Diaspora Catalog

Koodam implements native localization for all 14 districts and primary Malayali diaspora hubs:

```
[KL-TVM] Thiruvananthapuram (തിരുവനന്തപുരം)  - 8.5241°N, 76.9366°E
[KL-KLM] Kollam (കൊല്ലം)                       - 8.8932°N, 76.6141°E
[KL-PTA] Pathanamthitta (പത്തനംതിട്ട)          - 9.2648°N, 76.7870°E
[KL-ALP] Alappuzha (ആലപ്പുഴ)                  - 9.4981°N, 76.3388°E
[KL-KTM] Kottayam (കോട്ടയം)                    - 9.5916°N, 76.5222°E
[KL-IDK] Idukki (ഇടുക്കി)                      - 9.8500°N, 76.9667°E
[KL-EKM] Ernakulam / Kochi (എറണാകുളം/കൊച്ചി)    - 9.9816°N, 76.2999°E
[KL-TSR] Thrissur (തൃശ്ശൂർ)                    - 10.5276°N, 76.2144°E
[KL-PKD] Palakkad (പാലക്കാട്)                  - 10.7867°N, 76.6548°E
[KL-MLP] Malappuram (മലപ്പുറം)                  - 11.0732°N, 76.0740°E
[KL-KKD] Kozhikode (കോഴിക്കോട്)                - 11.2588°N, 75.7804°E
[KL-WYD] Wayanad (വയനാട്)                      - 11.6854°N, 76.1320°E
[KL-KNR] Kannur (കണ്ണൂർ)                        - 11.8745°N, 75.3704°E
[KL-KSD] Kasaragod (കാസർഗോഡ്)                - 12.5102°N, 74.9852°E
[DIA-DXB] Dubai, UAE (ദുബായ്)                  - 25.2048°N, 55.2708°E
[DIA-DOH] Doha, Qatar (ദോഹ)                   - 25.2854°N, 51.5310°E
[DIA-LON] London, UK (ലണ്ടൻ)                   - 51.5074°N, -0.1278°E
[DIA-BLR] Bengaluru, India (ബംഗളൂരു)          - 12.9716°N, 77.5946°E
[DIA-SIN] Singapore (സിംഗപ്പൂർ)                - 1.3521°N, 103.8198°E
```

---

## 4. Complete 23 Functional Modules Endpoint Specification

### 4.1 Module 1: Authentication (`/api/v1/auth`)
- **`POST /api/v1/auth/otp/send`**
  - **Body:** `{ "phone": "+919876543210", "channel": "whatsapp" | "sms" }`
  - **Response:** `{ "success": true, "data": { "message": "OTP sent successfully", "ttlSeconds": 300 } }`
- **`POST /api/v1/auth/otp/verify`**
  - **Body:** `{ "phone": "+919876543210", "code": "482910" }`
  - **Response:**
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "koodam_rf_...",
        "isNewUser": false,
        "user": { "id": "usr_...", "phone": "+919876543210", "role": "USER" }
      }
    }
    ```
- **`POST /api/v1/auth/refresh`**
  - **Body:** `{ "refreshToken": "koodam_rf_..." }`
  - **Response:** Fresh token pair `{ accessToken, refreshToken }`.
- **`POST /api/v1/auth/logout`**
  - Revokes current refresh token family and purges active session in Redis.

### 4.2 Module 2: Profiles (`/api/v1/profiles`)
- **`GET /api/v1/profiles/me`**
  - Returns authenticated user's profile, intentions, photo URLs, native & current district.
- **`PATCH /api/v1/profiles/me`**
  - **Body:**
    ```json
    {
      "displayName": "Anjali Nair",
      "bio": "Kochi Architect • Chai & Indie cinema",
      "dob": "1998-05-14",
      "homeDistrict": "KL-KTM",
      "exploringDistrict": "KL-EKM",
      "intentions": ["DATING_INTENTIONAL", "FIND_EVENTS"],
      "interests": ["Architecture", "Malayalam Cinema", "Trekking"]
    }
    ```
- **`POST /api/v1/profiles/me/location`**
  - **Body:** `{ "latitude": 9.9816, "longitude": 76.2999, "district": "KL-EKM" }`
  - Automatically calculates and stores Gaussian Ghost Centroid.

### 4.3 Module 3: Users & Photos (`/api/v1/users`)
- **`POST /api/v1/users/me/photos`**
  - Upload photo (max 6 photos allowed). Accepts `{ "url": "https://...", "isPrimary": true, "order": 0 }`.
- **`DELETE /api/v1/users/me/photos/:photoId`**
  - Removes photo and shifts order.
- **`DELETE /api/v1/users/me`**
  - GDPR-compliant hard deletion of user profile, photos, and associated data.

### 4.4 Module 4: Privacy Settings (`/api/v1/privacy`)
- **`GET /api/v1/privacy/settings`** & **`PATCH /api/v1/privacy/settings`**
  - **Body:**
    ```json
    {
      "privateMode": false,
      "showInDiscover": true,
      "showOnPeopleMap": true,
      "hideDistance": false
    }
    ```

### 4.5 Module 5: Blocks & Safety (`/api/v1/blocks`)
- **`POST /api/v1/blocks/:targetUserId`**
  - Symmetrical bidirectional blocking. Instantly hides profiles from feeds, chats, and discovery decks. Cached in Redis set `koodam:blocks:<userId>`.
- **`DELETE /api/v1/blocks/:targetUserId`**
  - Unblocks target user.

### 4.6 Module 6: Locations (`/api/v1/locations`)
- **`GET /api/v1/locations/districts`**
  - Retrieves all 14 Kerala districts and diaspora regions with coordinates and localized names.
- **`GET /api/v1/locations/reverse?lat=9.9816&lng=76.2999`**
  - Reverse geocodes coordinates to matching Kerala district code.

### 4.7 Module 7: Events Engine (`/api/v1/events`)
- **`POST /api/v1/events`**
  - **Strict Policy Rules:**
    1. Must occur on a single calendar day (start date == end date).
    2. Duration must not exceed 8 hours (480 minutes).
    3. Start time must be in the future.
  - **Body:**
    ```json
    {
      "title": "Fort Kochi Heritage Sunset Walk & Chai",
      "description": "Casual photo walk ending at Kashi Art Cafe with Sulaimani.",
      "category": "CULTURE_HERITAGE",
      "date": "2026-10-15",
      "startTime": "16:30",
      "endTime": "19:30",
      "locationName": "Vasco da Gama Square, Fort Kochi",
      "district": "KL-EKM",
      "latitude": 9.9674,
      "longitude": 76.2415,
      "capacity": 16,
      "genderBalanceEnabled": true,
      "ticketPrice": 0
    }
    ```
- **`GET /api/v1/events/feed?district=KL-EKM&category=CULTURE_HERITAGE&radiusKm=25`**
  - Spatial PostGIS feed returning upcoming single-day events.
- **`GET /api/v1/events/:id`**
  - Detailed gathering view with attendee rosters, host vouch trust score, and remaining seats.

### 4.8 Module 8: Event Attendees & QR Pass (`/api/v1/event-attendees`)
- **`POST /api/v1/event-attendees/:eventId/join`**
  - Atomic reservation with row-level lock (`FOR UPDATE`).
  - Enforces 50:50 gender balance equilibrium when enabled.
  - Generates unique secure QR entry pass code (e.g. `#KD-9284`).
- **`POST /api/v1/event-attendees/:eventId/check-in`**
  - Host scans attendee QR pass at the venue to mark attendance status `CHECKED_IN`.

### 4.9 Module 9: 3-Peer Trust Engine (`/api/v1/vouches`)
- **`POST /api/v1/vouches/generate-link/:eventId`**
  - Host creates tokenized WhatsApp vouch links to share with trusted Malayali peers.
- **`POST /api/v1/vouches/confirm/:token`**
  - Peer confirms vouch. Once 3 vouches are collected:
    - Event status transitions from `DRAFT` to `PUBLISHED`.
    - Event is indexed in Redis Geospatial store (`koodam:events:geo`).

### 4.10 Module 10: Intentional Dating Deck (`/api/v1/dating`)
- **`GET /api/v1/dating/deck?district=KL-EKM&intentions=DATING_INTENTIONAL`**
  - Multi-factor recommendation candidate scoring:
    $$\text{Score} = w_1(\text{shared\_intentions}) + w_2(\text{common\_events}) + w_3(\text{vouch\_score}) + w_4(\text{proximity})$$
  - Excludes blocked users, already connected users, and private profiles.

### 4.11 Module 11: Love Requests (`/api/v1/love-requests`)
- **`POST /api/v1/love-requests/send`**
  - **Body:** `{ "receiverId": "usr_...", "note": "Loved your architecture perspective at the Kochi meetup!" }`
  - Note is strictly capped at 140 characters.
  - Automatically sets 48-hour automated expiration TTL.
- **`POST /api/v1/love-requests/:id/respond`**
  - **Body:** `{ "action": "ACCEPT" | "DECLINE" }`
  - Mutual acceptance creates a `LOVE` connection and opens 1:1 chat.

### 4.12 Module 12: Dual-Track Connections (`/api/v1/connections`)
- **`GET /api/v1/connections?track=LOVE`** or `?track=CONNECT_FRIEND`
  - Returns companion list separated by romantic connection vs community event friend.

### 4.13 Module 13: 1:1 Messaging & Icebreakers (`/api/v1/messages`)
- **`GET /api/v1/messages/conversation/:connectionId?cursor=...&limit=30`**
  - Cursor-paginated message history.
- **`POST /api/v1/messages/send`**
  - **Body:** `{ "connectionId": "conn_...", "text": "Sulaimani or Filter Coffee? ☕" }`

### 4.14 Module 14: Real-Time WebSockets (`Socket.io`)
- **Endpoint:** `wss://koodam-mu.vercel.app` (Redis IoAdapter cluster)
- **Authentication:** Handshake headers `{ "auth": { "token": "Bearer <accessToken>" } }`
- **Events:**
  - `message:send` / `message:new`: Instant messaging.
  - `typing:indicator`: `{ "connectionId": "...", "isTyping": true }`.
  - `event:attendee_joined`: Live event capacity counter updates.
  - `notification:received`: High-priority in-app alerts.

### 4.15 Module 15: Event Community Chat (`/api/v1/event-chat`)
- Group chat rooms scoped to verified event attendees.
- Host announcement broadcast flags.

### 4.16 Module 16: Notifications (`/api/v1/notifications`)
- **`GET /api/v1/notifications`**: In-app notification inbox.
- **`PATCH /api/v1/notifications/:id/read`**: Mark as read.

### 4.17 Module 17: Search & Radar Discovery (`/api/v1/search`)
- **`GET /api/v1/search/radar?swLat=9.90&swLng=76.20&neLat=10.05&neLng=76.35`**
  - Viewport-bounded search returning active gatherings, community spots, and nearby opted-in member centroids.

### 4.18 Module 18: Recommendations (`/api/v1/recommendations`)
- Hybrid rule-based and similarity-based discovery feed recommendation.

### 4.19 Module 19: Payments (`/api/v1/payments`)
- PaymentProvider abstraction supporting Razorpay (UPI, Google Pay, Cards), Stripe, and Mock.
- Webhook signature verification on `/api/v1/payments/webhook`.

### 4.20 Module 20: Featured Gatherings (`/api/v1/featured-events`)
- Host promotional tiers: 1-Day Boost, 7-Day District Spotlight, 30-Day Diaspora Banner.

### 4.21 Module 21: Media & Presigned Uploads (`/api/v1/media`)
- **`POST /api/v1/media/presigned-url`**: Generates secure PUT URL for direct S3/storage image upload.

### 4.22 Module 22: Identity Verification (`/api/v1/verification`)
- Selfie gesture verification submission for Malayali Trust Blue Tick.

### 4.23 Module 23: Admin & Moderation (`/api/v1/admin`)
- RBAC moderation dashboard: Review reports, suspend violators, inspect audit logs.

---

# PART II: PROMPTS TO BUILD THE FLUTTER APP (FROM START TO STORE)

Use the following master prompts sequentially with an AI coding agent or development team to build the Koodam mobile client.

---

### Prompt 1: Project Architecture & Theme Foundation
```markdown
You are building the official Flutter client for Koodam (കൂടം) — Kerala's hyperlocal social gathering and intentional dating app.
Target platforms: iOS and Android using Flutter 3.24+ / Dart 3.x.

Create the core foundation:
1. Initialize a Clean Architecture directory structure:
   - lib/core/theme/ (Kerala Emerald Teal #0D9488, Kasavu Gold #F59E0B, Sunset Coral #F43F5E, Dark background #090D16, Card background #131B2E).
   - lib/core/constants/ (KeralaDistricts catalog containing all 14 districts: TVM, KLM, PTA, ALP, KTM, IDK, EKM, TSR, PKD, MLP, KKD, WYD, KNR, KSD + Diaspora: DXB, DOH, LON, BLR, SIN).
   - lib/core/network/ (ApiService connecting to https://koodam-mu.vercel.app with unified response envelopes).
   - lib/models/ (EventItem, DatingCandidate, ConnectionItem, ChatMessage).
2. Configure typography with GoogleFonts (Outfit for prominent titles, Plus Jakarta Sans for body text).
3. Ensure dark mode is the primary default theme with rich contrast and rounded cards (16px - 24px radius).
```

---

### Prompt 2: Authentication & District Onboarding
```markdown
Implement the onboarding and authentication flow for Koodam:
1. SplashScreen:
   - Centered golden Malayalam glyph "കൂ" inside an illuminated teal container.
   - Tagline: "Meet • Explore • Belong" with subtle pulse animation.
   - Automatically navigates to AuthOtpScreen or MainShell after 3 seconds.
2. AuthOtpScreen:
   - Phone input with country code default (+91 for Kerala).
   - District selection modal bottom sheet displaying all 14 Kerala districts with their Malayalam names and iconic spots (e.g., EKM • Fort Kochi & Marine Drive).
   - WhatsApp OTP toggle (SMS or WhatsApp Cloud API).
   - 6-digit pin entry field with auto-advance and countdown resend timer.
   - On verification, store JWT access token and refresh token securely.
```

---

### Prompt 3: Hyperlocal Gathering Feed with District Switcher
```markdown
Build the Home Gathering Feed screen for Koodam matching the stitch design mockups:
1. AppBar Header:
   - Prominent district picker pill showing current district with a tap action to open a bottom sheet selector across all 14 Kerala districts.
   - Unread notification bell icon.
2. Horizontal Category Filter Chips:
   - "All Gatherings", "Culture & Heritage", "Turf & Football", "Tech & Chai", "Indie Arts".
3. Safety Banner:
   - "Strict Single-Day Policy: All gatherings are 8 hours or under with 3-peer verified host trust."
4. Single-Day Event Card Component:
   - Date pill (e.g., "Today, 15 Oct") + Time span (e.g., "16:30 - 19:30").
   - Event title & 2-line truncated description.
   - Venue spot with location icon.
   - Live attendee counter (e.g., "11/16 Spots").
   - 50:50 Gender Equilibrium Badge ("50:50 Balance") when enabled.
   - "Join Spot" button that opens confirmation modal and generates a unique QR entry pass (#KD-XXXX).
5. Pull-to-refresh connecting to GET https://koodam-mu.vercel.app/api/v1/events/feed.
```

---

### Prompt 4: Single-Day Event Host Wizard
```markdown
Implement the Host Event creation wizard (CreateEventScreen):
1. Title & Description inputs.
2. District selection dropdown & venue meeting spot field.
3. Strict Single-Day Constraints:
   - Date picker locked to a single calendar day (start date == end date).
   - Duration slider strictly bounded between 1.0 hour and 8.0 hours. Disallow any value above 8 hours.
4. Capacity counter with 50:50 Gender Balance toggle switch.
5. Category selector.
6. Submit Button:
   - Calls POST /api/v1/events.
   - Opens a dialog: "3-Peer Vouch Required: Share your tokenized vouch link with 3 verified Malayali peers on WhatsApp to publish your event to the Kerala discovery map."
   - Button to copy WhatsApp deep-link to clipboard.
```

---

### Prompt 5: Live Radar Map with Ghost Centroid Privacy
```markdown
Implement the Live Radar Map screen (RadarMapScreen) matching stitch interactive map mockups:
1. Canvas Radar View:
   - Deep night-sky map canvas with concentric circular radar rings.
   - Pulsing radar beam animation.
2. Header Overlays:
   - "Kerala Live Radar" pill badge.
   - "Ghost Centroid: ~500m Blur" privacy indicator badge explaining GPS pins are blurred to protect user safety.
3. Map Pins:
   - Teal pins for single-day gatherings.
   - Kasavu Gold pins for startup/chai community spots.
   - Coral pins for nearby opted-in intentional dating members.
4. Bottom Horizontal Carousel:
   - Cards previewing events within viewport bounds with spot counts and distance tags.
```

---

### Prompt 6: Intentional Dating Deck & 140-Char Love Requests
```markdown
Build the Intentional Dating Deck screen (DatingDeckScreen):
1. Swipeable Candidate Card:
   - Full-bleed photo with dark gradient scrim at the bottom.
   - Candidate Name, Age, and Verified Blue Tick icon.
   - Location pill: Native district (e.g., "KTM Native") + Exploring district ("Exploring EKM") + Coarse distance ("4.8 km away").
   - Intentions tag pills: "DATING INTENTIONAL", "LIFE PARTNER".
   - Interest chips: "Malayalam Cinema", "Vinyl Records", "Trekking".
2. Floating Action Controls:
   - "Skip" (circular close button).
   - "Send Love" (elevated coral button).
3. Send Love Modal Bottom Sheet:
   - 140-character text area for an intentional note.
   - Notice: "Expires automatically in 48 hours if unanswered."
   - Sends POST /api/v1/love-requests/send.
```

---

### Prompt 7: Dual-Track Companion Messaging & Cultural Icebreakers
```markdown
Build the Connections and 1:1 Chat screens (ChatScreen):
1. Dual-Track Tab Navigation:
   - Tab 1: "Love Connections (കൂടം)" (Matches formed via accepted Love Requests).
   - Tab 2: "Gatherings & Friends" (Companions from joint events).
2. Conversation List:
   - Avatar with online presence dot (green) and Love heart badge for romantic matches.
   - Display name, timestamp, last message snippet, and unread counter badge.
3. 1:1 Conversation View:
   - Top cultural icebreakers horizontal carousel:
     - "Sulaimani or Filter Coffee? ☕"
     - "Best Monsoon spot: Wayanad or Munnar? 🌧️"
     - "Favorite vintage Malayalam movie soundtrack? 🎵"
   - Tapping an icebreaker populates and sends the prompt.
   - Custom chat bubbles: Teal for outgoing messages, Slate for incoming messages.
```

---

### Prompt 8: User Profile, Trust Vouches & Privacy Controls
```markdown
Build the Profile & Settings screen (ProfileScreen):
1. Header:
   - Primary avatar with verification checkmark.
   - Display Name, occupation, and district pills.
   - "3/3 Peer Vouches Verified" trust score badge.
2. 6-Photo Gallery Grid:
   - Primary photo tag on first tile.
   - Tap to add/replace photos.
3. Hyperlocal Privacy Toggles:
   - "Ghost Centroid Obfuscation": Switch to blur GPS by 400m–900m.
   - "Show in Intentional Dating Deck": Opt in/out of dating candidate deck.
   - "Private Ghost Mode": Only visible to mutually connected members.
4. Backend Connectivity Probe:
   - Live health indicator polling https://koodam-mu.vercel.app/health/live.
```
