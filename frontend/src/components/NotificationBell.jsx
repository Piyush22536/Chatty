import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotificationStore } from "../store/useNotificationStore";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost btn-circle relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-error text-error-content text-xs font-bold rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto divide-y divide-base-200">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-base-content/50">
                No notifications yet
              </li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n._id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-base-200 transition-colors ${
                    !n.read ? "bg-base-200/60" : ""
                  }`}
                  onClick={() => !n.read && markAsRead(n._id)}
                >
                  <img
                    src={n.senderProfilePic || "/avatar.png"}
                    alt={n.senderName}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{n.senderName}</p>
                    <p className="text-xs text-base-content/60 truncate">
                      {n.hasImage && !n.text ? "Sent an image" : n.text || "Sent a message"}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;