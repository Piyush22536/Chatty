import { createClient } from "redis";

let redisClient;

export async function connectRedis() {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  console.log("Connecting Redis to:", url);
  redisClient = createClient({ url });
  redisClient.on("error", (err) => console.error("Redis Error:", err));
  await redisClient.connect();
  console.log("Redis connected");
}

export function getRedisClient() {
  if (!redisClient) throw new Error("Redis not connected yet");
  return redisClient;
}

// Called at queue/worker init time (after env is loaded)
export function getBullMQConnection() {
  const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ...(isTLS && { tls: {} }),
  };
}