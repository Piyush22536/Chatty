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

export default new Proxy({}, {
  get(_, prop) {
    if (!redisClient) throw new Error("Redis not connected yet");
    const val = redisClient[prop];
    return typeof val === "function" ? val.bind(redisClient) : val;
  }
});

const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");

export const bullMQConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  ...(isTLS && { tls: {} }),
};