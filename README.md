![Chatty banner](https://github.com/user-attachments/assets/2f1a1295-e935-49f3-a991-0e3760bd91ff)

# Chatty

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
- **Image support** — send images uploaded asynchronously to Cloudinary
- **In-app notifications** — bell badge, dropdown panel, and toast alerts for incoming messages
- **Online presence** — see which users are currently online
- **Message caching** — Redis cache with write-through invalidation for fast chat history loads
- **Pagination** — cursor-based message loading (50 per page)
- **Rate limiting** — token bucket algorithm per user (messages) and per IP (auth)
- **JWT authentication** — HTTP-only cookie, 7-day expiry
- **Horizontal scaling** — multiple server instances share state through Redis; no sticky sessions required

---

## Architecture overview

The app runs as **two separate processes** that communicate through Redis and BullMQ.

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18, Zustand, Socket.IO client | UI, state, real-time |
| Server | Node.js, Express, Socket.IO | API, WebSocket gateway |
| Database | MongoDB Atlas | Users, messages, notifications |
| Cache & pub/sub | Redis (node-redis) | Cross-instance delivery, rate limiting, online user set |
| Queue | BullMQ (ioredis) | Async notification processing |
| Image storage | Cloudinary | Image upload and CDN |
| Auth | JWT, bcryptjs | HTTP-only cookie, 7-day expiry |

### Request flow

1. **React client** connects via Socket.IO (WebSocket) and REST (Axios) to whichever server instance it hits.
2. **Express server** handles auth, message persistence, and rate limiting. Each instance keeps a local `userSocketMap` of sockets connected *to that instance only*.
3. When a message is sent, the server publishes to the `chat:new-message` Redis channel. Every instance receives the event — whichever holds the recipient's socket delivers it.
4. The server also enqueues a `send-notification` BullMQ job. The worker process picks it up, saves to MongoDB, and publishes to `notification:new`.

### Message send flow

```
Client POST /api/messages/send/:id
  → JWT auth + token bucket rate limiter
  → Cloudinary upload (if image)
  → MongoDB save
  → Redis cache invalidation
  → publish chat:new-message
      → every server instance's sub client receives
      → instance holding receiver's socket emits newMessage
  → BullMQ enqueue send-notification (fire-and-forget)
      → worker saves Notification to MongoDB
      → worker publishes notification:new
      → instance holding recipient's socket emits notification
      → bell badge increments + toast appears
```

### Cache read flow

```
GET /api/messages/:id
  → check Redis key chat:<smallerId>:<largerId>
  → HIT  → return immediately
  → MISS → query MongoDB (.limit(50).sort({ _id: -1 }))
         → store in Redis (no TTL — valid until next write invalidates)
         → return
```

---

## Project structure

```
root/
├── backend/
│   └── src/
│       ├── cache/
│       │   └── message.cache.js           # Redis get/set/invalidate helpers
│       ├── controllers/
│       │   ├── auth.controller.js          # signup, login, logout, updateProfile
│       │   ├── message.controller.js       # getUsersForSidebar, getMessages, sendMessage
│       │   └── notifications.controller.js # getNotifications, unreadCount, markAsRead
│       ├── lib/
│       │   ├── cloudinary.js               # Cloudinary SDK config
│       │   ├── db.js                       # Mongoose connection
│       │   ├── pubsub.js                   # Redis pub + sub clients (lazy init)
│       │   ├── redis.js                    # Redis cache client + BullMQ connection
│       │   ├── socket.js                   # Socket.IO server, pub/sub listeners
│       │   └── utils.js                    # JWT generation
│       ├── middleware/
│       │   ├── auth.middleware.js           # protectRoute — JWT verify
│       │   ├── loginRateLimiter.js          # 5 attempts / 15 min per IP
│       │   └── rateLimiter.middleware.js    # 10 messages / sec per user
│       ├── models/
│       │   ├── message.model.js
│       │   ├── notification.model.js
│       │   └── user.model.js
│       ├── queue/
│       │   ├── notification.queue.js        # BullMQ Queue registration
│       │   └── notification.worker.js       # BullMQ Worker — save + publish
│       ├── routes/
│       │   ├── auth.route.js
│       │   ├── message.route.js
│       │   └── notification.route.js
│       ├── seeds/
│       │   └── user.seed.js                # Seed 15 demo users
│       ├── env.js                           # dotenv preload (--import flag)
│       ├── index.js                         # HTTP server entry point
│       └── worker.js                        # BullMQ worker entry point
│
└── frontend/
    └── src/
        ├── components/
        │   ├── ChatContainer.jsx
        │   ├── MessageInput.jsx
        │   ├── Navbar.jsx
        │   ├── NotificationBell.jsx         # Bell icon, badge, dropdown
        │   ├── Sidebar.jsx
        │   └── ...
        ├── hooks/
        │   └── useNotifications.jsx         # Socket listener + toast
        ├── lib/
        │   └── axios.js
        ├── pages/
        │   ├── HomePage.jsx
        │   ├── LoginPage.jsx
        │   ├── ProfilePage.jsx
        │   ├── SettingsPage.jsx
        │   └── SignUpPage.jsx
        ├── store/
        │   ├── useAuthStore.js              # Auth state + socket lifecycle
        │   ├── useChatStore.js              # Messages, users, socket subscriptions
        │   ├── useNotificationStore.js      # Notifications, unread count, mark-read
        │   └── useThemeStore.js
        └── App.jsx
```

---

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB Atlas account — [cloud.mongodb.com](https://cloud.mongodb.com)
- Redis Cloud account — [redis.io/try-free](https://redis.io/try-free) or [upstash.com](https://upstash.com)
- Cloudinary account — [cloudinary.com](https://cloudinary.com)

### Install

```bash
git clone https://github.com/Piyush22536/Chatty.git
cd Chatty

cd backend && npm install
cd ../frontend && npm install
```

---

## Environment variables

Create `backend/.env`:

```env
# Server
PORT=5001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/chatty?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_long_random_secret_here

# Redis
REDIS_URL=redis://default:<password>@<host>:<port>
REDIS_HOST=<host>
REDIS_PORT=<port>
REDIS_PASSWORD=<password>

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Running the app

The backend runs as **two separate processes**. Both must be running for full functionality.

```bash
# Terminal 1 — HTTP server (port 5001)
cd backend
npm run dev

# Terminal 2 — BullMQ worker
cd backend
npm run start:worker

# Terminal 3 — Frontend dev server (port 5173)
cd frontend
npm run dev
```

`backend/package.json` scripts:

```json
"scripts": {
  "dev":          "nodemon --import ./src/env.js src/index.js",
  "dev:2":        "cross-env PORT=5002 nodemon --import ./src/env.js src/index.js",
  "start":        "node --import ./src/env.js src/index.js",
  "start:worker": "node --import ./src/env.js src/worker.js",
  "seed":         "node --import ./src/env.js src/seeds/user.seed.js"
}
```

Open `http://localhost:5173` in your browser.

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
| `getOnlineUsers` | Server → all | `string[]` userIds | Online user list update |
| `newMessage` | Server → receiver | `Message` object | Real-time message delivery |
| `notification` | Server → recipient | `Notification` object | In-app notification |

---

## How key systems work

### Rate limiting — token bucket

Two independent limiters backed by Redis:

- **Login / signup** — 5 tokens per IP, refills at 1 token per 3 minutes. Key: `bucket:login:<ip>`
- **Send message** — 10 tokens per user, refills at 1 token per second. Key: `bucket:<userId>`

Each request reads the bucket from Redis, calculates tokens earned since `lastRefill`, consumes one token, and writes back. Returns `429 Too Many Requests` when tokens < 1.

### Message cache — write-through invalidation

- **Read**: `GET /messages/:id` checks `chat:<smallerId>:<largerId>` in Redis first. Hit → return immediately. Miss → query MongoDB, store, return.
- **Write**: after saving to MongoDB, `DEL` the cache key. No TTL — the cache is valid until exactly the moment a new message is written, eliminating any stale-read window.

### Pub/Sub — multi-instance socket delivery

Each server instance holds a local `userSocketMap` (`{ userId → socketId }`). When a message is saved, the controller publishes on `chat:new-message`. Every instance's sub client receives the event and checks its local map — only the instance holding that socket emits `newMessage` to the client. Others silently skip.

The same pattern applies to `notification:new`.

### BullMQ — async notification pipeline

1. Controller fire-and-forgets a `send-notification` job (5 attempts, exponential backoff)
2. Worker saves a `Notification` document to MongoDB
3. Worker publishes on `notification:new`
4. Correct server instance emits `notification` to the recipient's socket

The worker is a completely separate process. If it crashes, the HTTP server keeps running and jobs stay in the queue until the worker restarts.

---

## Scaling notes

### Testing pub/sub locally

Run two server instances simultaneously to verify cross-instance message delivery:

```bash
# Terminal 1
npm run dev        # port 5001

# Terminal 2
npm run dev:2      # port 5002
```

Open two browsers (e.g. Chrome + Edge incognito), log in as different users, and send messages. Watch both terminal logs — a message published through instance A should be received and delivered by instance B via Redis pub/sub, with no direct server-to-server communication.

### Production considerations

- Put a load balancer (nginx, AWS ALB) in front of multiple server instances
- Socket.IO requires WebSocket support — disable HTTP-only polling at the LB level
- The worker process can be scaled independently of the HTTP server
- Redis is the single point of coordination — use Redis Cluster or a managed service (Redis Cloud, Upstash) for HA