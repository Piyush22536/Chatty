// backend/src/controllers/message.controller.js
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { getCachedMessages, setCachedMessages } from "../cache/message.cache.js";
import redisClient from "../lib/redis.js";
import { pubClient } from "../lib/pubsub.js";
import { notificationQueue } from "../queue/message.queue.js";

// Get users for sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages (with Redis cache)
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const chatKey =
      myId < userToChatId
        ? `chat:${myId}:${userToChatId}`
        : `chat:${userToChatId}:${myId}`;

    const cachedMessages = await getCachedMessages(chatKey);
    if (cachedMessages) return res.status(200).json(cachedMessages);

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    await setCachedMessages(chatKey, messages);
    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send message — save synchronously, queue only the notification
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl = null;

    // Upload image if provided
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // 1. Save message (source of truth)
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    // Stable cache key
    const [a, b] = [
      senderId.toString(),
      receiverId.toString(),
    ].sort();

    const chatKey = `chat:${a}:${b}`;

    // 2. Publish realtime event
    // If this fails, receiver won't get instant delivery.
    // Therefore keep it in the critical path.
    await pubClient.publish(
      "chat:new-message",
      JSON.stringify({
        receiverId: receiverId.toString(),
        message: newMessage,
      })
    );

    // 3. Run non-critical tasks concurrently
    Promise.allSettled([
      // Cache invalidation
      redisClient.del(chatKey),

      // Push/email notification
      notificationQueue.add(
        "send-notification",
        {
          senderId: senderId.toString(),
          receiverId: receiverId.toString(),
          messageId: newMessage._id.toString(),
          text,
        },
        {
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        }
      ),
    ]).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error(
            "Background task failed:",
            result.reason
          );
        }
      });
    });

    // 4. Return response
    return res.status(201).json(newMessage);
  } catch (error) {
    console.error(
      "Error in sendMessage controller:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};