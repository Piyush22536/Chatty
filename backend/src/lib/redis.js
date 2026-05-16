import { createClient } from "redis";

// node-redis client — used for caching, rate limiting, online-user set, pub/sub
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (err) => console.error("Redis Error:", err));

export async function connectRedis() {
  await redisClient.connect();
  console.log("Redis connected");
}

export default redisClient;

// Exporting plain connection options so BullMQ can create its own ioredis instance internally.
export const bullMQConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};