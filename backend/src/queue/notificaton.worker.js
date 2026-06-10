import { Worker } from "bullmq";
import Notification from "../models/notification.model.js";
import { bullMQConnection } from "../lib/redis.js";
import { pubClient } from "../lib/pubsub.js";

// ---------------------------------------------------------------------------
// Job handler: "send-notification"
//
// Responsibilities:
//   1. Persist the notification to MongoDB
//   2. Publish it via Redis Pub/Sub so the server instance that holds the
//      recipient's socket can emit a "notification" event in real time
//
// This runs in the WORKER PROCESS (node src/worker.js), not the HTTP server.
// ---------------------------------------------------------------------------
async function handleSendNotification(job) {
  const { senderId, recipientId, messageId, text, hasImage, senderName, senderProfilePic } =
    job.data;

  // 1. Persist to MongoDB
  const notification = await Notification.create({
    recipientId,
    senderId,
    messageId,
    text,
    hasImage,
    read: false,
  });

  // 2. Build the enriched payload the client will receive
  const payload = {
    _id: notification._id.toString(),
    senderId,
    senderName,
    senderProfilePic,
    messageId,
    text,
    hasImage,
    read: false,
    createdAt: notification.createdAt,
  };

  // 3. Publish to all server instances — the one holding the socket emits it
  await pubClient.publish(
    "notification:new",
    JSON.stringify({ recipientId, notification: payload })
  );
}

// ---------------------------------------------------------------------------
// Worker registration — imported by src/worker.js
// ---------------------------------------------------------------------------
export const notificationWorker = new Worker(
  "notification-queue",
  async (job) => {
    if (job.name === "send-notification") {
      await handleSendNotification(job);
    } else {
      throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: bullMQConnection,
    concurrency: 15,
  }
);

notificationWorker.on("completed", (job) =>
  console.log(`[NotificationWorker] done: ${job.id}`)
);

notificationWorker.on("failed", (job, err) =>
  console.error(`[NotificationWorker] failed: ${job?.id} —`, err.message)
);