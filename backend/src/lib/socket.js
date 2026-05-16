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
const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId.toString()];
}

// Called once at startup — clears any leftover online_users from a previous
// crash so stale entries don't show users as online when they're not.
export async function clearStaleOnlineUsers() {
  await redisClient.del("online_users");
  console.log("Cleared stale online_users from Redis");
}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.id);
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
    await redisClient.sAdd("online_users", userId);
  }

  const onlineUsers = await redisClient.sMembers("online_users");
  io.emit("getOnlineUsers", onlineUsers);

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      await redisClient.sRem("online_users", userId);
    }
    const onlineUsers = await redisClient.sMembers("online_users");
    io.emit("getOnlineUsers", onlineUsers);
  });
});

export async function setupPubSubListeners() {
  await subClient.subscribe("chat:new-message", (raw) => {
    const { receiverId, message } = JSON.parse(raw);
    const socketId = userSocketMap[receiverId];
    if (socketId) {
      io.to(socketId).emit("newMessage", message);
    }
  });
  console.log("Subscribed to Redis pub/sub channel: chat:new-message");
}

export { io, app, server };