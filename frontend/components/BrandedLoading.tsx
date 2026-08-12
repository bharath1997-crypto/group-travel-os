"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RovvyIcon } from "@/components/RovvyLogo";

interface BrandedLoadingProps {
  fullScreen?: boolean;
  message?: string;
}

export default function BrandedLoading({
  fullScreen = true,
  message = "Loading Rovvy...",
}: BrandedLoadingProps) {
  const [statusMessage, setStatusMessage] = useState(message);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial online status
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Timers for progressive messaging
    const timer1 = setTimeout(() => {
      if (isOnline) {
        setStatusMessage("This is taking longer than usual...");
      }
    }, 5000); // 5 seconds

    const timer2 = setTimeout(() => {
      if (isOnline) {
        setStatusMessage("Please check your internet connection.");
      }
    }, 10000); // 10 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      setStatusMessage("You appear to be offline. Please check your connection.");
    } else {
      setStatusMessage(message);
    }
  }, [isOnline, message]);

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-app"
    : "flex flex-col items-center justify-center p-8 w-full h-full min-h-[200px]";

  return (
    <div className={containerClasses} suppressHydrationWarning>
      <div className="relative flex flex-col items-center">
        {/* Animated outer ring */}
        <div className="absolute h-20 w-20 animate-spin rounded-full border-2 border-[#CCFBF1] border-t-[#0F766E]" />
        
        {/* Logo Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
          <RovvyIcon size={40} className="animate-pulse" />
        </div>
      </div>

      {/* Status Message */}
      <p className="mt-6 text-center text-sm font-medium text-[#1C2B3A]">
        {statusMessage}
      </p>

      {/* Offline Indicator */}
      {!isOnline && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
          Offline
        </span>
      )}
    </div>
  );
}
