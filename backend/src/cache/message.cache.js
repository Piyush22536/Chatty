import redisClient from "../lib/redis.js";

export const getCachedMessages = async (chatId) => {
  const data = await redisClient.get(`chat:${chatId}`);
  return data ? JSON.parse(data) : null;
};

export const setCachedMessages = async (chatId, messages) => {
  await redisClient.set(
    `chat:${chatId}`,
    JSON.stringify(messages),
    { EX: 60 }   // cache expires in 60 seconds
  );
};