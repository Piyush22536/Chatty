/**
 * Worker entry point — run as a SEPARATE process from the HTTP server.
 *
 *   node src/worker.js
 *
 * In Docker / production, run this as its own container so it can
 * crash, restart, and scale independently of the API server.
 */

import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./lib/db.js";
import { connectRedis } from "./lib/redis.js";
import { connectPubSub } from "./lib/pubsub.js";

import "./queue/notification.worker.js";

(async () => {
  console.log("[Worker] Starting...");
  await connectDB();
  await connectRedis();
  await connectPubSub(); // pubClient used by notificationWorker to publish after save
  console.log("[Worker] Ready — listening on notification-queue");
})();