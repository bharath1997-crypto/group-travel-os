"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft } from "@/components/icons";
import { Eye, Shield, MessageSquare } from "lucide-react";

export default function PrivacyPage() {
  const [profileVisibility, setProfileVisibility] = useState("everyone"); // everyone, friends, only_me
  const [storyVisibility, setStoryVisibility] = useState("friends");
  const [locationVisibility, setLocationVisibility] = useState("friends");
  
  const [allowMessaging, setAllowMessaging] = useState("friends");
  const [allowTagging, setAllowTagging] = useState("everyone");
  const [showActivity, setShowActivity] = useState(true);

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-4">
          <Link href="/profile" className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <IconArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-stone-800">Privacy Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 mt-6 space-y-6">
        {/* Section 1: Visibility */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={20} className="text-teal-600" />
            <h2 className="text-lg font-bold text-stone-800">Visibility</h2>
          </div>
          
          <div className="space-y-4">
            <VisibilityOption 
              label="Profile Visibility" 
              description="Who can see your profile details and bio."
              value={profileVisibility}
              onChange={setProfileVisibility}
            />
            <VisibilityOption 
              label="Story Visibility" 
              description="Who can see your shared stories and highlights."
              value={storyVisibility}
              onChange={setStoryVisibility}
            />
            <VisibilityOption 
              label="Live Location" 
              description="Who can see your real-time location on the map."
              value={locationVisibility}
              onChange={setLocationVisibility}
            />
          </div>
        </div>

        {/* Section 2: Interactions */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-teal-600" />
            <h2 className="text-lg font-bold text-stone-800">Interactions</h2>
          </div>
          
          <div className="space-y-4">
            <VisibilityOption 
              label="Who can message me" 
              description="Control who can send you direct messages."
              value={allowMessaging}
              onChange={setAllowMessaging}
            />
            <VisibilityOption 
              label="Who can tag or mention me" 
              description="Control who can tag you in trips or photos."
              value={allowTagging}
              onChange={setAllowTagging}
            />
          </div>
        </div>

        {/* Section 3: Activity & Safety */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={20} className="text-teal-600" />
            <h2 className="text-lg font-bold text-stone-800">Activity & Safety</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-700">Show Activity Status</p>
                <p className="text-xs text-stone-500">Allow others to see when you are active.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showActivity}
                className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                style={{ background: showActivity ? "#0d9488" : "#ccc" }}
                onClick={() => setShowActivity(!showActivity)}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
                  style={{ left: showActivity ? 22 : 2 }}
                />
              </button>
            </div>
            
            <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-700">Blocked Users</p>
                <p className="text-xs text-stone-500">Manage the people you've blocked.</p>
              </div>
              <Link href="/settings/blocked" className="text-sm font-semibold text-teal-600 hover:text-teal-700">
                Manage →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisibilityOption({ label, description, value, onChange }: { 
  label: string; 
  description: string; 
  value: string; 
  onChange: (val: string) => void; 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-50 pb-4 last:border-0 last:pb-0">
      <div>
        <p className="font-semibold text-stone-700">{label}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 bg-white"
      >
        <option value="everyone">Everyone</option>
        <option value="friends">Friends / Buddies</option>
        <option value="only_me">Only Me</option>
      </select>
    </div>
  );
}
