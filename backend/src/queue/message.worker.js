import { Worker } from "bullmq";
import Message from "../models/message.model.js";
import redisClient from "../lib/redis.js";
import { pubClient } from "../lib/pubsub.js";

const worker = new Worker(
  "message-queue",
  async (job) => {
    const { senderId, receiverId, text, image } = job.data;

    // 1. Save to MongoDB
    const newMessage = new Message({ senderId, receiverId, text, image });
    await newMessage.save();

    // 2. Invalidate the Redis message cache for this chat
    const chatKey =
      senderId < receiverId
        ? `chat:${senderId}:${receiverId}`
        : `chat:${receiverId}:${senderId}`;
    await redisClient.del(chatKey);

    // 3. Publish to Redis Pub/Sub.
    //    ALL server instances are subscribed to "chat:new-message".
    //    Each server checks its local userSocketMap — whichever server
    //    has the receiver connected will emit the socket event.
    await pubClient.publish(
      "chat:new-message",
      JSON.stringify({
        receiverId: receiverId.toString(),
        message: newMessage,
      })
    );
  },
  { connection: redisClient }
);

worker.on("completed", (job) => {
  console.log("Message job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("Message job failed:", job.id, err.message);
});