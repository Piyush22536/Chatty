import redisClient from '../lib/redis.js';

export const getCachedMessages = async (chatKey) => {
  try {
    const data = await redisClient.get(chatKey);
    if (!data) return null;
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse cached messages:', error);
    return null;
  }
};

export const setCachedMessages = async (chatKey, messages) => {
  try {
    await redisClient.set(chatKey, JSON.stringify(messages), {
      EX: 60, // Expires in 60 seconds
    });
  } catch (error) {
    console.error('Failed to set cached messages:', error);
  }
};
