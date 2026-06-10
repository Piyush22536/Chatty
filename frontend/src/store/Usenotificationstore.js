import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

export const useNotificationStore = create((set, get) => ({
  notifications: [],      // array of notification objects
  unreadCount: 0,
  isLoading: false,

  // -------------------------------------------------------------------------
  // Fetch all recent notifications (called on mount / reconnect)
  // -------------------------------------------------------------------------
  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/notifications");
      const notifications = res.data;
      const unreadCount = notifications.filter((n) => !n.read).length;
      set({ notifications, unreadCount });
    } catch (error) {
      console.error("fetchNotifications:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  // -------------------------------------------------------------------------
  // Called by socket listener when a "notification" event arrives.
  // Prepends the new notification and increments the badge.
  // -------------------------------------------------------------------------
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 30),
      unreadCount: state.unreadCount + 1,
    }));
  },

  // -------------------------------------------------------------------------
  // Mark a single notification as read (optimistic + server sync)
  // -------------------------------------------------------------------------
  markAsRead: async (notificationId) => {
    // Optimistic update
    set((state) => {
      const updated = state.notifications.map((n) =>
        n._id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = updated.filter((n) => !n.read).length;
      return { notifications: updated, unreadCount };
    });

    try {
      await axiosInstance.patch(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error("markAsRead failed:", error);
      // Re-sync from server on failure
      get().fetchNotifications();
    }
  },

  // -------------------------------------------------------------------------
  // Mark all as read
  // -------------------------------------------------------------------------
  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    try {
      await axiosInstance.patch("/notifications/read-all");
    } catch (error) {
      console.error("markAllAsRead failed:", error);
      get().fetchNotifications();
    }
  },
}));