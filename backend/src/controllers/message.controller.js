import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getCachedMessages, setCachedMessages } from "../cache/message.cache.js";
import redisClient from "../lib/redis.js";
import { pubClient } from "../lib/pubsub.js";
import { notificationQueue } from "../queue/notification.queue.js";

// Canonical cache key — same order regardless of who is sender/receiver
const chatCacheKey = (a, b) =>
  a.toString() < b.toString() ? `chat:${a}:${b}` : `chat:${b}:${a}`;

// ---------------------------------------------------------------------------
// GET /api/messages/users
// ---------------------------------------------------------------------------
export const getUsersForSidebar = async (req, res) => {
  try {
    const filteredUsers = await User.find({ _id: { $ne: req.user._id } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
--------
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const { before } = req.query;
    const PAGE_SIZE = 50;

    // Only cache the first page (no cursor)
    if (!before) {
      const cached = await getCachedMessages(chatCacheKey(myId, userToChatId));
      if (cached) return res.status(200).json(cached);
    }

    const query = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    };
    if (before) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE)
      .lean();

    const ordered = messages.reverse();

    if (!before) await setCachedMessages(chatCacheKey(myId, userToChatId), ordered);

    res.status(200).json(ordered);
  } catch (error) {
    console.error("getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/messages/send/:id
//
// Critical path  (awaited, response blocked):
//   1. Cloudinary upload (if image)
//   2. MongoDB save
//   3. Redis cache invalidation
//   4. Pub/Sub publish → real-time delivery via socket
//
// Non-critical path (fire-and-forget via Promise.allSettled):
//   5. Enqueue notification job → BullMQ worker
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const sender = req.user; // full user object from protectRoute

    // 1. Upload image synchronously (receiver won't see it until it has a URL)
    let imageUrl = null;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // 2. Persist message
    const newMessage = await Message.create({
      senderId: sender._id,
      receiverId,
      text,
      image: imageUrl,
    });

    const cacheKey = chatCacheKey(sender._id, receiverId);

    // 3. Invalidate cache so next GET fetches fresh data
    await redisClient.del(cacheKey);

    // 4. Publish real-time event (critical — receiver won't get instant
    //    delivery if this fails, so we keep it in the awaited path)
    await pubClient.publish(
      "chat:new-message",
      JSON.stringify({ receiverId: receiverId.toString(), message: newMessage })
    );

   
    Promise.allSettled([
      notificationQueue.add(
        "send-notification",
        {
          senderId: sender._id.toString(),
          senderName: sender.fullName,
          senderProfilePic: sender.profilePic ?? "",
          recipientId: receiverId.toString(),
          messageId: newMessage._id.toString(),
          text: text ?? "",
          hasImage: !!imageUrl,
        },
        {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
        }
      ),
    ]).then((results) => {
      results.forEach((r) => {
        if (r.status === "rejected") {
          console.error("[sendMessage] background task failed:", r.reason);
        }
      });
    });

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("sendMessage:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};