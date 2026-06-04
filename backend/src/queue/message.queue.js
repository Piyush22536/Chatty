import { Queue } from "bullmq";
import { bullMQConnection } from "../lib/redis.js";

export const notificationQueue = new Queue("notification-queue", {
  connection: bullMQConnection,
});