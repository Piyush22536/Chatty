import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageSquare, Settings, User } from "lucide-react";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40
        backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold">ChatApp</h1>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {authUser && (
              <>
                {/* 🔔 Notification bell — drop it here */}
                <NotificationBell />

                <Link to="/settings" className="btn btn-ghost btn-circle">
                  <Settings className="w-5 h-5" />
                </Link>

                <Link to="/profile" className="btn btn-ghost btn-circle">
                  <User className="w-5 h-5" />
                </Link>

                <button className="btn btn-ghost btn-circle" onClick={logout}>
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;