import { Server } from "socket.io";
import http from "http";
import express from "express";
import { subClient } from "./pubsub.js";
import redisClient from "./redis.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ["http://localhost:5173"] },
});

// Local map — only sockets connected to THIS server instance.
// When horizontally scaled, each instance has its own partial map.
const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId.toString()];
}

const ONLINE_USERS_KEY = "online_users";
const SOCKET_MAP_KEY   = "socket_map"; // Redis hash: userId → socketId

export async function clearStaleOnlineUsers() {
  await redisClient.del(ONLINE_USERS_KEY);
  await redisClient.del(SOCKET_MAP_KEY);
  console.log("Cleared stale online_users and socket_map from Redis");
}

// ---------------------------------------------------------------------------
// Socket.IO connection
// ---------------------------------------------------------------------------
io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
    await redisClient.sAdd(ONLINE_USERS_KEY, userId);
    // Persist mapping so other instances can check online status
    await redisClient.hSet(SOCKET_MAP_KEY, userId, socket.id);
  }

  const onlineUsers = await redisClient.sMembers(ONLINE_USERS_KEY);
  io.emit("getOnlineUsers", onlineUsers);

  socket.on("disconnect", async () => {
    if (userId) {
      delete userSocketMap[userId];
      await redisClient.sRem(ONLINE_USERS_KEY, userId);
      await redisClient.hDel(SOCKET_MAP_KEY, userId);
    }
    const onlineUsers = await redisClient.sMembers(ONLINE_USERS_KEY);
    io.emit("getOnlineUsers", onlineUsers);
  });
});

// ---------------------------------------------------------------------------
// Pub/Sub listeners — called once at startup.
//
// Two channels:
//   "chat:new-message"  — real-time message delivery
//   "notification:new"  — in-app notification delivery
//
// Each server instance receives every publish. Only the instance whose
// local userSocketMap contains the recipient's socketId will emit.
// ---------------------------------------------------------------------------
export async function setupPubSubListeners() {
  // Channel 1: chat messages
  await subClient.subscribe("chat:new-message", (raw) => {
    const { receiverId, message } = JSON.parse(raw);
    const socketId = userSocketMap[receiverId];
    if (socketId) {
      io.to(socketId).emit("newMessage", message);
    }
  });

  // Channel 2: notifications
  await subClient.subscribe("notification:new", (raw) => {
    const { recipientId, notification } = JSON.parse(raw);
    const socketId = userSocketMap[recipientId];
    if (socketId) {
      // "notification" event — client increments badge + shows toast
      io.to(socketId).emit("notification", notification);
    }
  });

  console.log("Subscribed to Redis pub/sub channels: chat:new-message, notification:new");
}

export { io, app, server };