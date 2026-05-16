import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import "./queue/message.worker.js";
import path from "path";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server, setupPubSubListeners } from "./lib/socket.js";
import { connectRedis } from "./lib/redis.js";
import { connectPubSub } from "./lib/pubsub.js";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, async () => {
  console.log("Server running on PORT:" + PORT);
  connectDB();
  await connectRedis();
  await connectPubSub();        // connect pub + sub clients
  await clearStaleOnlineUsers(); // remove leftover entries from a previous crash
  await setupPubSubListeners(); // subscribe to chat:new-message channel
});