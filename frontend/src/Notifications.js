import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useNotificationStore } from "../store/useNotificationStore";
import toast from "react-hot-toast";


export function useNotifications() {
  const socket = useAuthStore((s) => s.socket);
  const authUser = useAuthStore((s) => s.authUser);
  const { fetchNotifications, addNotification } = useNotificationStore();

  // Fetch on mount / when user changes
  useEffect(() => {
    if (!authUser) return;
    fetchNotifications();
  }, [authUser]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification) => {
      addNotification(notification);

      // Show a brief toast so the user doesn't miss it while in another chat
      toast.custom(
        (t) => (
          <div
            className={`flex items-center gap-3 bg-base-100 border border-base-300
              shadow-lg rounded-xl px-4 py-3 max-w-xs cursor-pointer
              ${t.visible ? "animate-enter" : "animate-leave"}`}
            onClick={() => toast.dismiss(t.id)}
          >
            <img
              src={notification.senderProfilePic || "/avatar.png"}
              alt={notification.senderName}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{notification.senderName}</p>
              <p className="text-xs text-base-content/60 truncate">
                {notification.hasImage && !notification.text
                  ? "Sent an image"
                  : notification.text || "Sent a message"}
              </p>
            </div>
          </div>
        ),
        { duration: 4000, position: "top-right" }
      );
    };

    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [socket]);
}