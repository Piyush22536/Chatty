# ChatApp

A full-stack real-time chat application built with React, Node.js, Socket.IO, Redis, MongoDB, and BullMQ. Supports instant messaging, image sharing, in-app notifications, online presence, and is designed to scale horizontally across multiple server instances.

---

## Table of contents

- [Features](#features)
- [Architecture overview](#architecture-overview)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [API reference](#api-reference)
- [How key systems work](#how-key-systems-work)
- [Scaling notes](#scaling-notes)

---

## Features

- **Real-time messaging** — instant delivery via Socket.IO and Redis Pub/Sub
- **Image support** — send images that are uploaded asynchronously to Cloudinary
- **In-app notifications** — bell badge, dropdown panel, and toast alerts for incoming messages
- **Online presence** — see which users are currently online
- **Message caching** — Redis cache with write-through invalidation for fast chat history loads
- **Pagination** — cursor-based message loading (50 per page)
- **Rate limiting** — token bucket algorithm per user (messages) and per IP (auth)
- **JWT authentication** — HTTP-only cookie, 7-day expiry
- **Horizontal scaling** — two independent processes (server + worker) that share state via Redis

---

## Architecture overview

The app runs as **two separate processes** that communicate through Redis and BullMQ.

```
┌─────────────────────────────────────────────┐
│                  Client                      │
│         React + Zustand + Socket.IO          │
└──────────────┬───────────────┬──────────────┘
               │ HTTP REST     │ WebSocket
               ▼               ▼
┌──────────────────────────────────────────────┐
│           Process 1 — HTTP server            │
│   Express · Socket.IO · Pub/Sub listener     │
│   JWT auth · Token bucket rate limiter       │
└──────────┬───────────────────────────────────┘
           │ BullMQ enqueue (fire-and-forget)
           ▼
┌──────────────────────────────────────────────┐
│           Process 2 — Worker                 │
│   Cloudinary upload · MongoDB save           │
│   Redis cache invalidation · Pub/Sub publish │
│   Notification persist · FCM / email         │
└──────────────────────────────────────────────┘
           │ Both processes share:
           ▼
┌────────────────────────────────────────────────────────────┐
│                       Data layer                            │
│  MongoDB          Redis              BullMQ queue           │
│  users            message cache      notification-queue     │
│  messages         online_users set                          │
│  notifications    rate limit buckets                        │
│                   pub/sub channels                          │
│                     chat:new-message                        │
│                     notification:new                        │
└────────────────────────────────────────────────────────────┘
```

**Message send flow:**

1. Client `POST /api/messages/send/:id`
2. JWT auth + token bucket rate limiter
3. Controller uploads image to Cloudinary, saves message to MongoDB, invalidates Redis cache, publishes on `chat:new-message`
4. Sub client on every server instance receives the publish — whichever instance holds the receiver's socket emits `newMessage`
5. Controller fire-and-forgets a `send-notification` job into BullMQ
6. Worker picks up the job, saves a `Notification` document, publishes on `notification:new`
7. Sub client emits `notification` to the recipient's socket → bell badge increments + toast appears

**Cache read flow:**

1. `GET /api/messages/:id` checks Redis first
2. Cache hit → return immediately (no TTL — valid until next write invalidates it)
3. Cache miss → query MongoDB with `.limit(50).sort({ _id: -1 })`, store result, return

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Zustand, Socket.IO client, DaisyUI, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express, Socket.IO server |
| Database | MongoDB with Mongoose |
| Cache & pub/sub | Redis (node-redis) |
| Queue | BullMQ (ioredis internally) |
| Image storage | Cloudinary |
| Auth | JSON Web Tokens, bcryptjs |
| Notifications | BullMQ worker (pluggable: FCM, APNs, SendGrid) |

---

## Project structure

```
root/
├── backend/
│   └── src/
│       ├── cache/
│       │   └── message.cache.js          # Redis get/set/invalidate helpers
│       ├── controllers/
│       │   ├── auth.controller.js         # signup, login, logout, updateProfile
│       │   ├── message.controller.js      # getUsersForSidebar, getMessages, sendMessage
│       │   └── notification.controller.js # getNotifications, getUnreadCount, markAsRead, markAllAsRead
│       ├── lib/
│       │   ├── cloudinary.js              # Cloudinary SDK config
│       │   ├── db.js                      # Mongoose connection
│       │   ├── pubsub.js                  # Redis pub + sub clients
│       │   ├── redis.js                   # Redis cache client + BullMQ connection options
│       │   ├── socket.js                  # Socket.IO server, pub/sub listeners, online users
│       │   └── utils.js                   # JWT generation
│       ├── middleware/
│       │   ├── auth.middleware.js          # protectRoute (JWT verify)
│       │   ├── loginRateLimiter.js         # token bucket — 5 attempts / 15 min per IP
│       │   └── rateLimiter.middleware.js   # token bucket — 10 messages / sec per user
│       ├── models/
│       │   ├── message.model.js
│       │   ├── notification.model.js
│       │   └── user.model.js
│       ├── queue/
│       │   ├── notification.queue.js       # BullMQ Queue registration
│       │   └── notification.worker.js      # BullMQ Worker — save + pub/sub publish
│       ├── routes/
│       │   ├── auth.route.js
│       │   ├── message.route.js
│       │   └── notification.route.js
│       ├── seeds/
│       │   └── user.seed.js               # Seed 15 demo users
│       ├── index.js                        # Express app entry point (HTTP server process)
│       └── worker.js                       # Worker entry point (separate process)
│
└── frontend/
    └── src/
        ├── components/
        │   ├── ChatContainer.jsx
        │   ├── MessageInput.jsx
        │   ├── Navbar.jsx
        │   ├── NotificationBell.jsx        # Bell icon, badge, dropdown
        │   ├── Sidebar.jsx
        │   └── ...
        ├── hooks/
        │   └── useNotifications.js         # Socket listener + toast on incoming notif
        ├── lib/
        │   └── axios.js
        ├── pages/
        │   ├── HomePage.jsx
        │   ├── LoginPage.jsx
        │   ├── ProfilePage.jsx
        │   ├── SettingsPage.jsx
        │   └── SignUpPage.jsx
        ├── store/
        │   ├── useAuthStore.js             # Auth state + socket connect/disconnect
        │   ├── useChatStore.js             # Messages, users, socket subscriptions
        │   ├── useNotificationStore.js     # Notifications, unread count, mark-read
        │   └── useThemeStore.js
        └── App.jsx
```


## Running the app

The backend runs as **two separate processes**. Both must be running for the full feature set to work.

```bash
# Terminal 1 — HTTP server
cd backend
npm run start

# Terminal 2 — BullMQ worker (notifications)
cd backend
npm run start:worker

# Terminal 3 — Frontend dev server
cd frontend
npm run dev
```

Add these scripts to `backend/package.json`:

```json
"scripts": {
  "start": "node src/index.js",
  "start:worker": "node src/worker.js",
  "dev": "nodemon src/index.js",
  "dev:worker": "nodemon src/worker.js",
  "seed": "node src/seeds/user.seed.js"
}
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:5001`.

---

## API reference

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/signup` | — | Create account |
| `POST` | `/login` | — | Login (rate limited: 5 attempts / 15 min per IP) |
| `POST` | `/logout` | — | Clear JWT cookie |
| `PUT` | `/update-profile` | ✓ | Upload new profile picture |
| `GET` | `/check` | ✓ | Validate current session |

### Messages — `/api/messages`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users` | ✓ | List all users for sidebar |
| `GET` | `/:id` | ✓ | Fetch messages (paginated, `?before=<id>`) |
| `POST` | `/send/:id` | ✓ | Send a message (rate limited: 10 / sec per user) |

### Notifications — `/api/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ✓ | Last 30 notifications |
| `GET` | `/unread-count` | ✓ | Unread count only |
| `PATCH` | `/:id/read` | ✓ | Mark single notification as read |
| `PATCH` | `/read-all` | ✓ | Mark all as read |

### Socket.IO events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `getOnlineUsers` | Server → all clients | `string[]` (userIds) | Online user list update |
| `newMessage` | Server → receiver | `Message` object | Real-time message delivery |
| `notification` | Server → recipient | `Notification` object | In-app notification delivery |

---

## How key systems work

### Rate limiting — token bucket

Two independent limiters backed by Redis:

- **Login / signup** — 5 tokens per IP, refills at 1 token per 3 minutes. Keyed by `bucket:login:<ip>`.
- **Send message** — 10 tokens per user, refills at 1 token per second. Keyed by `bucket:<userId>`.

Each request reads the bucket from Redis, calculates tokens earned since `lastRefill`, consumes one token, and writes back atomically. If tokens < 1, returns `429 Too Many Requests`.

### Message cache — write-through invalidation

- On `GET /messages/:id` (first page, no cursor): check `chat:<smallerId>:<largerId>` in Redis. Hit → return. Miss → query MongoDB, store with no TTL.
- On `sendMessage`: after saving to MongoDB, immediately `DEL` the cache key. The next `GET` repopulates it from MongoDB with fresh data.
- No TTL means no stale-read window. The cache is valid until exactly the moment a new message is written.

### Pub/Sub — multi-instance socket delivery

Redis Pub/Sub solves the problem of delivering a socket event when the sender and receiver are connected to different server instances.

Each server instance maintains a local `userSocketMap` (`{ userId → socketId }`). When the controller publishes on `chat:new-message`, every instance's sub client receives it. Each instance checks its local map — only the instance holding that socket emits. The others silently do nothing.

The same pattern applies to `notification:new`.

### BullMQ — async notification pipeline

The notification job is the only thing BullMQ is responsible for end-to-end:

1. Controller fire-and-forgets a `send-notification` job (attempts: 5, exponential backoff)
2. Worker picks it up, saves a `Notification` document to MongoDB, publishes on `notification:new`
3. Sub client on the correct server instance emits `notification` to the recipient's socket

The worker runs as a completely separate process (`node src/worker.js`). If it crashes, the HTTP server keeps running and jobs stay in the queue — they will be processed when the worker restarts.

