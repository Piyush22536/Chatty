import { Worker } from "bullmq";
import User from "../models/user.model.js";
import { getBullMQConnection } from "../lib/redis.js";
import { getRedisClient } from "../lib/redis.js";
import admin from "../lib/firebase.js";

// ---------------------------------------------------------------------------
// Job handler: "send-notification"
//
// Responsibilities:
//   1. Check if the recipient is currently online (in Redis online_users set).
//      If online — skip the push (they already see the message in real time).
//   2. If offline — look up their FCM token and send a push via Firebase.
//
// This runs in the WORKER PROCESS (node src/worker.js), not the HTTP server.
// ---------------------------------------------------------------------------
async function handleSendNotification(job) {
  const { senderId, recipientId, messageId, text, hasImage, senderName, senderProfilePic } =
    job.data;

  // 1. Skip if recipient is currently online — they see the message live via socket
  const isOnline = await getRedisClient().sIsMember("online_users", recipientId);
  if (isOnline) {
    console.log(`[NotificationWorker] recipient ${recipientId} is online — skipping FCM push`);
    return;
  }

  // 2. Fetch the recipient's FCM token
  const recipient = await User.findById(recipientId).select("fcmToken").lean();
  if (!recipient?.fcmToken) {
    console.log(`[NotificationWorker] no FCM token for recipient ${recipientId} — skipping`);
    return;
  }

  // 3. Build the notification body
  const notificationBody = hasImage && !text ? "📷 Sent an image" : text || "Sent a message";

  // 4. Send FCM push notification
  const message = {
    token: recipient.fcmToken,
    notification: {
      title: senderName,
      body: notificationBody,
    },
    data: {
      senderId: senderId.toString(),
      senderName,
      senderProfilePic: senderProfilePic ?? "",
      messageId: messageId.toString(),
      hasImage: String(hasImage),
    },
    webpush: {
      notification: {
        icon: senderProfilePic || "/avatar.png",
        badge: "/badge.png",
        requireInteraction: false,
      },
      fcmOptions: {
        link: "/", // clicking the notification opens the app
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`[NotificationWorker] FCM push sent: ${response}`);
  } catch (err) {
    // If the token is invalid/expired, clear it so we don't keep trying
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      await User.findByIdAndUpdate(recipientId, { fcmToken: null });
      console.warn(`[NotificationWorker] cleared stale FCM token for ${recipientId}`);
    } else {
      throw err; // let BullMQ retry
    }
  }
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
    connection: getBullMQConnection(),
    concurrency: 15,
  }
);

notificationWorker.on("completed", (job) =>
  console.log(`[NotificationWorker] done: ${job.id}`)
);

notificationWorker.on("failed", (job, err) =>
  console.error(`[NotificationWorker] failed: ${job?.id} —`, err.message)
);