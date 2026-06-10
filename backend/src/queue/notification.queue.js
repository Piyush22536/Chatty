import { Queue } from "bullmq";
import { bullMQConnection } from "../lib/redis.js";

// Single queue for notification jobs.
// Job name "send-notification" is the only type processed by the worker.
export const notificationQueue = new Queue("notification-queue", {
  connection: bullMQConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});