import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { requestNotificationPermission, onForegroundMessage } from "../lib/firebase.js";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
      get().initFCM();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
      get().initFCM();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
      get().initFCM();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  // -------------------------------------------------------------------------
  // FCM: request permission, get token, POST to backend, register foreground
  // message handler so toasts show when the tab is in focus.
  // -------------------------------------------------------------------------
  initFCM: async () => {
    try {
      const token = await requestNotificationPermission();
      if (!token) return;

      // Persist token on the backend so the worker can look it up
      await axiosInstance.post("/auth/fcm-token", { fcmToken: token });

      // Show an in-app toast for foreground messages (tab is open + focused)
      onForegroundMessage((payload) => {
        const { title, body } = payload.notification ?? {};
        const data = payload.data ?? {};

        toast.custom(
          (t) => (
            <div
              className={`flex items-center gap-3 bg-base-100 border border-base-300
                shadow-lg rounded-xl px-4 py-3 max-w-xs cursor-pointer
                ${t.visible ? "animate-enter" : "animate-leave"}`}
              onClick={() => toast.dismiss(t.id)}
            >
              <img
                src={data.senderProfilePic || "/avatar.png"}
                alt={title}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{title}</p>
                <p className="text-xs text-base-content/60 truncate">{body}</p>
              </div>
            </div>
          ),
          { duration: 4000, position: "top-right" }
        );
      });
    } catch (err) {
      console.error("[FCM] initFCM error:", err);
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
