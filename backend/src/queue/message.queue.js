import { Queue } from "bullmq";
import { bullMQConnection } from "../lib/redis.js";

export const messageQueue = new Queue("message-queue", {
  connection: bullMQConnection, // ioredis options
});