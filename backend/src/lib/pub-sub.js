import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Publisher — used by the BullMQ worker to publish messages
export const pubClient = createClient({ url: REDIS_URL });

// Subscriber — used by each server to receive published messages.
// Must be a separate connection: once subscribed, a Redis client
// can ONLY run subscribe/unsubscribe commands.
export const subClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("Redis pub error:", err));
subClient.on("error", (err) => console.error("Redis sub error:", err));

export async function connectPubSub() {
  await pubClient.connect();
  await subClient.connect();
  console.log("Redis Pub/Sub connected");
}