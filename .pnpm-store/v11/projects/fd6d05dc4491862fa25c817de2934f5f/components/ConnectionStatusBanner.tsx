"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function ConnectionStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      // Hide banner after a delay when coming back online
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner && isOnline) return null;

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
        isOnline
          ? "bg-emerald-500 text-white"
          : "bg-red-600 text-white"
      }`}
      role="status"
    >
      <div className="flex items-center gap-2">
        {!isOnline && <WifiOff className="h-4 w-4" />}
        <span>
          {isOnline
            ? "Back online!"
            : "You are currently offline. Some features may be unavailable."}
        </span>
      </div>
    </div>
  );
}
