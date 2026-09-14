# Koodam (കൂടം) — Master API Documentation & Integration Specification
> **Platform Target:** iOS & Android Native Mobile App (Flutter) + Enterprise Cloud Backend (NestJS / Node.js)  
> **Live Production Base URL:** `https://koodam-mu.vercel.app`  
> **Health Check:** `https://koodam-mu.vercel.app/health` & `https://koodam-mu.vercel.app/health/live`  
> **Interactive Swagger UI:** `https://koodam-mu.vercel.app/api/docs`  
> **GitHub Backend Repository:** [git@github.com:abbasalitmk/koodam.git](https://github.com/abbasalitmk/koodam)  
> **GitHub Mobile Client Repository:** [git@github.com:abbasalitmk/koodam_app.git](https://github.com/abbasalitmk/koodam_app)

---

## 1. Architectural Principles & Client Conventions

### 1.1 Uniform Response Envelope
All REST endpoints strictly return a unified JSON envelope:

**Success Response (HTTP 200 / 201):**
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

**Error Response (HTTP 4xx / 5xx):**
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

### 1.2 Authentication & Token Handling
1. Send OTP to mobile phone number (+91 for Kerala, +971 for UAE, +44 for UK, etc.) via SMS or WhatsApp Cloud API.
2. Verify OTP to receive:
   - `accessToken` (Short-lived JWT, default 15 minutes)
   - `refreshToken` (Long-lived rotating refresh token family, 30 days)
   - `isNewUser` boolean flag indicating whether the profile onboarding flow is required.
3. Every authenticated request MUST include the Authorization header:
   ```http
   Authorization: Bearer <accessToken>
   ```
4. When `HTTP 401` (`AUTH_TOKEN_EXPIRED`) is received, the client silently calls `POST /api/v1/auth/refresh` with `{ "refreshToken": "..." }` to obtain a fresh token pair.

### 1.3 Ghost Centroid Privacy Math
The backend **never exposes exact GPS coordinates** of any user:
- Whenever a user updates their location (`POST /api/v1/profiles/me/location`), the server creates a blurred centroid with a random Gaussian radial displacement between **400m and 900m**.
- All distance calculations return rounded, coarse distances (`distanceKm`: e.g. `2.4 km`).

---

## 2. Kerala Districts & Global Diaspora Locations

Koodam supports all 14 administrative districts of Kerala and major global diaspora hubs:

| Code | Location Name | Region | Latitude | Longitude |
| :--- | :--- | :--- | :--- | :--- |
| `KL-TVM` | Thiruvananthapuram | South Kerala | 8.5241 | 76.9366 |
| `KL-KLM` | Kollam | South Kerala | 8.8932 | 76.6141 |
| `KL-PTA` | Pathanamthitta | Central Travancore | 9.2648 | 76.7870 |
| `KL-ALP` | Alappuzha | Central Kerala | 9.4981 | 76.3388 |
| `KL-KTM` | Kottayam | Central Kerala | 9.5916 | 76.5222 |
| `KL-IDK` | Idukki | High Ranges | 9.8500 | 76.9667 |
| `KL-EKM` | Ernakulam / Kochi | Central Kerala | 9.9816 | 76.2999 |
| `KL-TSR` | Thrissur | Cultural Capital | 10.5276 | 76.2144 |
| `KL-PKD` | Palakkad | Gateway of Kerala | 10.7867 | 76.6548 |
| `KL-MLP` | Malappuram | Malabar | 11.0732 | 76.0740 |
| `KL-KKD` | Kozhikode | Malabar Coast | 11.2588 | 75.7804 |
| `KL-WYD` | Wayanad | High Ranges | 11.6854 | 76.1320 |
| `KL-KNR` | Kannur | North Malabar | 11.8745 | 75.3704 |
| `KL-KSD` | Kasaragod | North Malabar | 12.5102 | 74.9852 |
| `DIA-DXB` | Dubai | UAE Diaspora | 25.2048 | 55.2708 |
| `DIA-DOH` | Doha | Qatar Diaspora | 25.2854 | 51.5310 |
| `DIA-LON` | London | UK Diaspora | 51.5074 | -0.1278 |
| `DIA-BLR` | Bengaluru | India Diaspora | 12.9716 | 77.5946 |
| `DIA-SIN` | Singapore | SEA Diaspora | 1.3521 | 103.8198 |

---

## 3. Complete Endpoint Reference

### 3.1 Authentication & Onboarding
- **`POST /api/v1/auth/otp/send`**  
  Send OTP via SMS or WhatsApp Cloud API.
  ```json
  { "phone": "+919876543210", "channel": "whatsapp" }
  ```
- **`POST /api/v1/auth/otp/verify`**  
  Verify OTP code and retrieve JWT session.
  ```json
  { "phone": "+919876543210", "code": "482910" }
  ```
- **`POST /api/v1/auth/refresh`**  
  Rotate refresh token family and get new access token.
  ```json
  { "refreshToken": "koodam_rf_..." }
  ```
- **`POST /api/v1/auth/logout`**  
  Revoke current device session and purge cached Redis tokens.

### 3.2 User Profile & Discovery Preferences
- **`GET /api/v1/profiles/me`**  
  Get full authenticated user profile.
- **`PATCH /api/v1/profiles/me`**  
  Update profile metadata, bio, native district, current district, occupation, Malayalam proficiency.
  ```json
  {
    "displayName": "Anjali Nair",
    "bio": "Kochi creative • Coffee enthusiast • Looking for trek companions",
    "homeDistrict": "KL-EKM",
    "exploringDistrict": "KL-KKD",
    "intentions": ["FIND_EVENTS", "DATING_INTENTIONAL", "MAKE_FRIENDS"],
    "dob": "1998-05-14"
  }
  ```
- **`POST /api/v1/profiles/me/location`**  
  Update location with automatic Gaussian Ghost Centroid obfuscation (~400m–900m).
  ```json
  { "latitude": 9.9816, "longitude": 76.2999, "district": "KL-EKM" }
  ```
- **`POST /api/v1/users/me/photos`**  
  Upload profile photos (max 6, primary avatar selector, reordering).
- **`GET /api/v1/privacy/settings`** & **`PATCH /api/v1/privacy/settings`**  
  Toggle Private Mode, `showInDiscover`, `showOnPeopleMap`, and distance radius visibility.

### 3.3 Strict Single-Day Events Engine
Events in Koodam are strictly limited to single-day gatherings (maximum 8 hours) to ensure intimacy, safety, and focused community interaction.
- **`POST /api/v1/events`**  
  Create single-day event.
  ```json
  {
    "title": "Fort Kochi Heritage Sunset Walk & Chai",
    "description": "Casual photo walk starting at Vasco da Gama Square ending at Kashi Art Cafe.",
    "category": "CULTURE_HERITAGE",
    "date": "2026-10-15",
    "startTime": "16:30",
    "endTime": "19:30",
    "locationName": "Vasco da Gama Square, Fort Kochi",
    "latitude": 9.9674,
    "longitude": 76.2415,
    "capacity": 16,
    "genderBalanceEnabled": true,
    "ticketPrice": 0
  }
  ```
- **`GET /api/v1/events/feed`**  
  Hyperlocal event feed with spatial radius filtering:
  `?latitude=9.9816&longitude=76.2999&radiusKm=25&district=KL-EKM&category=CULTURE_HERITAGE`
- **`GET /api/v1/events/:id`**  
  Detailed event view with attendee counts, host profile, vouch trust status, and spot availability.
- **`POST /api/v1/event-attendees/:eventId/join`**  
  Atomic row-level reservation ensuring gender balance equilibrium (50:50). Generates secure QR Pass (`#KD-XXXX`).
- **`POST /api/v1/event-attendees/:eventId/check-in`**  
  Host QR code check-in scanner at the event venue.

### 3.4 3-Peer Trust Engine (Vouches)
To guarantee real, safe community events without spam:
- **`POST /api/v1/vouches/generate-link/:eventId`**  
  Host generates tokenized WhatsApp vouch links to invite 3 trusted peers.
- **`POST /api/v1/vouches/confirm/:token`**  
  Peer confirms vouch for host. Once 3 vouches are collected, event is promoted to `PUBLISHED` status and indexed in Redis geospatial store (`koodam:events:geo`).

### 3.5 Intentional Dating & Love Requests
- **`GET /api/v1/dating/deck`**  
  Smart candidate deck tailored for intentional dating with multi-factor scoring (shared intentions, common events, verified status, proximity).
- **`POST /api/v1/love-requests/send`**  
  Send Love Request with an optional 140-character intentional message.
  ```json
  {
    "receiverId": "usr_9481ab...",
    "note": "Loved your book recommendation at the Kozhikode literature meetup!"
  }
  ```
- **`POST /api/v1/love-requests/:id/respond`**  
  Accept or Decline. Mutual acceptance creates a `LOVE` connection and unlocks 1:1 direct messaging.
  *Note: Love requests automatically expire after 48 hours if unanswered.*

### 3.6 Connections & 1:1 Messaging
- **`GET /api/v1/connections`**  
  Retrieve companion list categorized by `CONNECT_FRIEND` vs `LOVE`.
- **`GET /api/v1/messages/conversation/:connectionId`**  
  Cursor-paginated conversation history.
- **`POST /api/v1/messages/send`**  
  Send message with Malayalam cultural icebreakers support.

### 3.7 Live Radar Map (PostGIS Hyperlocal Discovery)
- **`GET /api/v1/search/radar`**  
  Retrieves active events, verified gathering spots, and nearby opted-in people pins within map viewport bounds (`swLat, swLng, neLat, neLng`).

### 3.8 Real-Time WebSockets (Socket.io)
Connect via WebSocket client:
```javascript
const socket = io('https://koodam-mu.vercel.app', {
  auth: { token: 'Bearer <accessToken>' },
  transports: ['websocket']
});

// Real-time events:
socket.on('message:new', (msg) => { ... });
socket.on('typing:indicator', ({ senderId, isTyping }) => { ... });
socket.on('event:attendee_joined', (data) => { ... });
socket.on('notification:received', (notif) => { ... });
```

---

## 4. Environment Variables for Production Database

When linking your managed PostgreSQL (with PostGIS) and Redis to Vercel:

```bash
# In Vercel Project Settings > Environment Variables:
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"
REDIS_URL="rediss://:<password>@<redis-host>:6379"
JWT_SECRET="<generate-64-character-random-hex-string>"
JWT_REFRESH_SECRET="<generate-different-64-character-random-hex-string>"
```
