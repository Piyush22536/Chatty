import redisClient from "../lib/redis.js";


export const getCachedMessages = async (chatKey) => {
  const data = await redisClient.get(chatKey);
  return data ? JSON.parse(data) : null;
};

export const setCachedMessages = async (chatKey, messages) => {
  await redisClient.set(
    chatKey,
    JSON.stringify(messages),
    { EX: 60 } // 60 sec expiry
  );
};