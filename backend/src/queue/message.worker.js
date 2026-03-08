import { Worker } from "bullmq";
import Message from "../models/message.model.js";
import redisClient from "../lib/redis.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const worker = new Worker(
  "message-queue",
  async (job) => {

    const { senderId, receiverId, text, image } = job.data;

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image,
    });

    await newMessage.save();

    // clear cache
    const chatKey =
      senderId < receiverId
        ? `chat:${senderId}:${receiverId}`
        : `chat:${receiverId}:${senderId}`;

    await redisClient.del(chatKey);

    // send realtime message
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
  },
  {
    connection: redisClient,
  }
);

worker.on("completed", (job) => {
  console.log("Message job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.log("Message job failed:", err);
});