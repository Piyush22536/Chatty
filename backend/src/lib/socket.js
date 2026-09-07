import { Server } from "socket.io";
import http from "http";
import express from "express";
import { getSubClient } from "./pubsub.js";
import { getRedisClient } from "./redis.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: [process.env.CLIENT_URL, "http://localhost:5173"] },
});

// Local map — only sockets connected to THIS server instance.
const userSocketMap = {};

let redisReady = false;

export function setRedisReady() {
  redisReady = true;
}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId.toString()];
}

const ONLINE_USERS_KEY = "online_users";
const SOCKET_MAP_KEY   = "socket_map";

export async function clearStaleOnlineUsers() {
  await getRedisClient().del(ONLINE_USERS_KEY);
  await getRedisClient().del(SOCKET_MAP_KEY);
  console.log("Cleared stale online_users and socket_map from Redis");
}

// ---------------------------------------------------------------------------
// Socket.IO connection
// ---------------------------------------------------------------------------
io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;

    if (redisReady) {
      await getRedisClient().sAdd(ONLINE_USERS_KEY, userId);
      await getRedisClient().hSet(SOCKET_MAP_KEY, userId, socket.id);
    }
  }

  if (redisReady) {
    const onlineUsers = await getRedisClient().sMembers(ONLINE_USERS_KEY);
    io.emit("getOnlineUsers", onlineUsers);
  } else {
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  socket.on("disconnect", async () => {
    if (userId) {
      delete userSocketMap[userId];

      if (redisReady) {
        await getRedisClient().sRem(ONLINE_USERS_KEY, userId);
        await getRedisClient().hDel(SOCKET_MAP_KEY, userId);
      }
    }

    if (redisReady) {
      const onlineUsers = await getRedisClient().sMembers(ONLINE_USERS_KEY);
      io.emit("getOnlineUsers", onlineUsers);
    } else {
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

// ---------------------------------------------------------------------------
// Pub/Sub listeners — called once at startup after Redis is ready.
// ---------------------------------------------------------------------------
export async function setupPubSubListeners() {
  await getSubClient().subscribe("chat:new-message", (raw) => {
    const { receiverId, message } = JSON.parse(raw);
    const socketId = userSocketMap[receiverId];
    if (socketId) io.to(socketId).emit("newMessage", message);
  });

  console.log("Subscribed to Redis pub/sub channels: chat:new-message");
}

export { io, app, server };