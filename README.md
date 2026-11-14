# TOGETHER — Serverless Watch-Party Platform

> **"Paste a supported video link. Create a room. Invite friends. Watch together."**

Together is a real-time social video web application built strictly according to the PRD specification. It enables synchronized YouTube video playback, live chat, floating reactions, video queueing, and room moderation — with persistent storage backed by **Neon Serverless PostgreSQL**.

---

## 🌟 Key Features

- **Instant Zero-Friction Rooms**: Paste a YouTube link (`watch?v=`, `youtu.be`, `/shorts/`, `/embed/`), choose a display name, and create a room in seconds.
- **No Mandatory Guest Signup**: Friends click your invite link, type a name, and join immediately.
- **Authoritative Host-Controlled Playback (V1)**: The host controls Play, Pause, Seek, Speed rate, and Video changes.
- **Drift Correction Engine**: Real-time position calculation and gentle seek correction keep all participants aligned with millisecond precision (<0.5s tolerance).
- **Autoplay Restriction Handling**: Automatically detects browser autoplay blocks and presents an interactive "Tap to Join Playback" button.
- **Real-Time Live Chat**: Instant messaging with Host 👑 and Guest badges, timestamps, audio toggle, and auto-scroll.
- **Floating Emoji Reactions**: Heart ❤️, Fire 🔥, Laugh 😂, Applause 👏, Party 🎉, and Mindblown 🤯 burst over the video canvas in real-time.
- **Up Next / Video Queue**: Shared playlist queue where hosts and participants can queue upcoming videos with automatic transition.
- **Host Moderation & Security**: Room lock toggle, member kick functionality, host role transfer, and private passcode protection.
- **Freemium & Monetization**: Free tier (up to 3 viewers) vs **Together Premium (₹199/month)** supporting up to 15 viewers, custom themes, and unlimited duration. Server-side entitlements stored in Neon DB.

---

## 🗄️ Database Architecture (Neon Serverless PostgreSQL)

The platform connects to **Neon PostgreSQL** with automated connection pooling and SSL support.

### Relational Schema

- **`users`**: User identities, display names, guest flags, and avatar colors.
- **`rooms`**: Room IDs, host user reference, YouTube video ID, privacy flag, passcodes, lock status, max capacity, and theme.
- **`room_members`**: Active and historical room participants, roles (`host` / `guest`), and join timestamps.
- **`room_messages`**: Real-time chat messages with room association and timestamps.
- **`video_queue`**: Queued videos with titles, thumbnails, and position order.
- **`subscriptions`**: Entitlement records, plan details (`free` / `premium`), status, and expiration dates.

---

## 🚀 Quick Start

### 1. Install & Build
```bash
# Build both client and server
npm run build
```

### 2. Run All Tests
```bash
# Runs full test suite verifying Neon DB, WebSockets, and Playback sync
npm test
```

### 3. Start Application
```bash
# Starts unified server on http://localhost:4000
npm start
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser!

---

## 📡 API & Realtime Protocol

### HTTP Endpoints
- `POST /api/rooms` — Create a new watch party room
- `GET /api/rooms/:id` — Get room details, capacity, and status
- `POST /api/rooms/:id/join` — Join room and receive signed JWT session token
- `POST /api/rooms/:id/lock` — Host locks/unlocks room
- `DELETE /api/rooms/:id/members/:memberId` — Host removes participant
- `POST /api/rooms/validate-url` — Validate YouTube link and fetch thumbnail metadata
- `POST /api/billing/checkout` — Initiate ₹199/mo Premium checkout session
- `POST /api/billing/upgrade-room` — Instant room capacity upgrade
- `GET /api/health` — Service health check & Neon DB ping

### WebSocket Protocol
Connect to: `ws://localhost:4000/api/rooms/:roomId/connect?token=<signed_token>`

Events supported:
- `room:state` (Initial snapshot)
- `playback:play`, `playback:pause`, `playback:seek`, `playback:rate`, `video:change`
- `chat:message`
- `reaction:send`
- `member:join`, `member:leave`, `member:kick`
- `host:transfer`, `room:lock`, `room:closed`
- `queue:add`, `queue:remove`, `queue:next`, `queue:sync`

---

## 📁 Repository Structure

```
together/
├── client/                     # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/         # VideoPlayer, LiveChat, Participants, VideoQueue, Modals
│   │   ├── hooks/              # useYouTubePlayer, useRoomSocket
│   │   ├── pages/              # LandingPage, WatchRoomPage, JoinRoomPage
│   │   ├── services/           # api.ts (API client)
│   │   └── types.ts            # Frontend shared types
├── server/                     # Node.js + Express + WebSockets + Neon DB
│   ├── src/
│   │   ├── db.ts               # Neon PostgreSQL pool with SSL
│   │   ├── room/
│   │   │   ├── coordinator.ts  # In-memory Room Coordinator (Durable Object pattern)
│   │   │   └── manager.ts      # Active rooms lifecycle manager
│   │   ├── routes/             # rooms.ts, billing.ts
│   │   ├── utils/              # youtube.ts, auth.ts (JWT & session tokens)
│   │   ├── websocket.ts        # WebSocket upgrade & dispatch
│   │   └── index.ts            # Server entry point & static SPA serving
│   └── test/
│       ├── integration.test.ts # Core engine & Neon DB unit tests
│       └── e2e.test.ts         # Full multi-socket real-time playback test
└── package.json
```
