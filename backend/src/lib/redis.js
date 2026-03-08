import { createClient } from "redis";

const redisClient = createClient({
  url: "redis://127.0.0.1:6379"
});

redisClient.on("error", (err) => {
  console.log("Redis Error:", err);
});

export async function connectRedis() {
  await redisClient.connect();
  console.log("Redis Connected");
}

export default redisClient;