import Notification from "../models/notification.model.js";

// ---------------------------------------------------------------------------
// GET /api/notifications
// Returns the 30 most recent notifications for the logged-in user.
// Populates sender name + avatar so the client doesn't need extra requests.
// ---------------------------------------------------------------------------
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("senderId", "fullName profilePic")
      .lean();

    // Normalise the populated sender into flat fields the client expects
    const shaped = notifications.map((n) => ({
      _id: n._id,
      senderId: n.senderId?._id,
      senderName: n.senderId?.fullName ?? "Unknown",
      senderProfilePic: n.senderId?.profilePic ?? "",
      messageId: n.messageId,
      text: n.text,
      hasImage: n.hasImage,
      read: n.read,
      createdAt: n.createdAt,
    }));

    res.status(200).json(shaped);
  } catch (error) {
    console.error("getNotifications:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// Lightweight endpoint polled (or called on reconnect) to sync badge count.
// ---------------------------------------------------------------------------
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user._id,
      read: false,
    });
    res.status(200).json({ count });
  } catch (error) {
    console.error("getUnreadCount:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id/read
// Marks a single notification as read.
// ---------------------------------------------------------------------------
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("markAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all
// Marks every unread notification as read for the current user.
// ---------------------------------------------------------------------------
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, read: false },
      { read: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("markAllAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};