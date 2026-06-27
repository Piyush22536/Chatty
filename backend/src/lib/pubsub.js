import { createClient } from "redis";

let pubClient;
let subClient;

export async function connectPubSub() {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  console.log("Connecting PubSub to:", url);

  pubClient = createClient({ url });
  subClient = pubClient.duplicate();

  pubClient.on("error", (err) => console.error("Redis pub error:", err));
  subClient.on("error", (err) => console.error("Redis sub error:", err));

  await pubClient.connect();
  await subClient.connect();
  console.log("Redis Pub/Sub connected");
}

export function getPubClient() {
  if (!pubClient) throw new Error("PubSub not connected yet");
  return pubClient;
}

export function getSubClient() {
  if (!subClient) throw new Error("PubSub not connected yet");
  return subClient;
}

// Proxy exports so existing imports keep working (pubClient.publish etc.)
export { pubClient, subClient };