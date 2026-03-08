import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

import { getCachedMessages, setCachedMessages } from "../cache/message.cache.js";
import redisClient from "../lib/redis.js";

import { messageQueue } from "../queue/message.queue.js";


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

    // 1️ check Redis cache
    const cachedMessages = await getCachedMessages(chatKey);

    if (cachedMessages) {
      return res.status(200).json(cachedMessages);
    }

    // 2️ fetch from MongoDB if cache miss
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // 3️ store in cache
    await setCachedMessages(chatKey, messages);

    res.status(200).json(messages);

  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


// ==============================
// Send message (QUEUE PRODUCER)
// ==============================
export const sendMessage = async (req, res) => {
  try {

    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl = null;

    // upload image to Cloudinary
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // push job to queue
    await messageQueue.add(
      "send-message",
      {
        senderId,
        receiverId,
        text,
        image: imageUrl,
      },
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );

    res.status(201).json({
      message: "Message queued successfully",
    });

  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};