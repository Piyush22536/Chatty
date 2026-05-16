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
// Each server has its own copy; they are NOT shared.
const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId.toString()];
}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.id);
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
    // Track online users in Redis so ALL server instances agree
    await redisClient.sAdd("online_users", userId);
  }

  // Broadcast the full online-user set (across all servers)
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

// Called once at startup — each server subscribes to the shared channel.
// When the worker PUBLISHes a message, every server receives it here.
// Each server then checks its LOCAL userSocketMap: if the receiver
// is connected to THIS instance, it emits to that socket.
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