// backend/src/queue/message.worker.js
import { Worker } from "bullmq";
import { bullMQConnection } from "../lib/redis.js";

//  Put your real notification logic here:
const sendNotification = async ({ senderId, receiverId, messageId, text }) => {
  // Example placeholder — replace with your actual notification service
  console.log(
    `[Notification] User ${senderId} sent a message to ${receiverId}: "${text?.slice(0, 50)}"`
  );
  // await firebaseAdmin.messaging().send({ ... });
  // await sendgrid.send({ ... });
};

const worker = new Worker(
  "notification-queue",
  async (job) => {
    await sendNotification(job.data);
  },
  { connection: bullMQConnection }
);

worker.on("completed", (job) => {
  console.log("Notification job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("Notification job failed:", job.id, err.message);
});