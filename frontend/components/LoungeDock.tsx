"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Send,
  User,
  Users,
  Search,
  Settings,
  Plus,
  Check,
  Paperclip,
  Mic,
  Smile,
  Sparkles,
  Cloud,
  Phone,
  Video,
  SquarePen,
  Menu,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { initFirebase } from "@/lib/firebase-client";
import { ref, onValue, push, set, off } from "firebase/database";

type Contact = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
};

type Member = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_admin: boolean;
};

type Chat = {
  id: string;
  type: string; // "direct" | "group" | "trip"
  name: string | null;
  trip_id: string | null;
  created_by: string | null;
  created_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  avatar_url: string | null;
  members: Member[];
};

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  text: string;
  timestamp: number;
  type?: string;
  wayra_visible?: boolean;
  location_details?: {
    place_name: string | null;
    city: string | null;
    country: string | null;
    latitude: number;
    longitude: number;
    thumbnail: string;
    confidence: string;
  };
};

export function LoungeDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null); // single active chat ID
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<Record<string, boolean>>({});

  // Search & Navigation
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "updates">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showNewChatOverlay, setShowNewChatOverlay] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);

  // Backup Settings
  const [backupInterval, setBackupInterval] = useState("24h");
  const [wifiOnly, setWifiOnly] = useState(true);

  // Wayra status tracking
  const [wayraStatus, setWayraStatus] = useState<Record<string, { enabled: boolean; off_since: string | null }>>({});

  // Firebase Ref
  const firebaseInstance = useRef<ReturnType<typeof initFirebase> | null>(null);
  const firebaseListeners = useRef<Record<string, () => void>>({});

  // Fetch initial data
  useEffect(() => {
    // 1. Fetch current user
    apiFetch<{ id: string; full_name: string }>("/auth/me")
      .then((user) => setCurrentUser(user))
      .catch(() => {});

    // 2. Fetch chats
    fetchChats();

    // 3. Fetch contacts
    apiFetch<Contact[]>("/lounge/contacts")
      .then((data) => setContacts(data))
      .catch(() => {});

    // Initialize Firebase Client
    firebaseInstance.current = initFirebase();

    // Toggle and open events
    const handleToggle = () => {
      setIsOpen((prev) => !prev);
    };
    const handleOpenAi = () => {
      setIsOpen(true);
    };
    window.addEventListener("toggle-rovvy-lounge", handleToggle);
    window.addEventListener("open-ai-sidecar", handleOpenAi);

    return () => {
      window.removeEventListener("toggle-rovvy-lounge", handleToggle);
      window.removeEventListener("open-ai-sidecar", handleOpenAi);

      // Clean up firebase subscriptions
      Object.values(firebaseListeners.current).forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const fetchChats = async () => {
    try {
      const data = await apiFetch<Chat[]>("/lounge/chats");
      setChats(data);
    } catch {}
  };

  const toggleWayra = async (chatId: string) => {
    const currentStatus = wayraStatus[chatId];
    if (!currentStatus) return;
    const newEnabled = !currentStatus.enabled;
    try {
      const res = await apiFetch<{ status: string; enabled: boolean }>(`/wayra/group/${chatId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.status === "success") {
        setWayraStatus((prev) => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            enabled: res.enabled,
            off_since: res.enabled ? null : new Date().toISOString(),
          },
        }));
      }
    } catch (err) {
      alert("Only group administrators can toggle Wayra AI settings.");
    }
  };

  const handleThreadClick = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id)) {
      apiFetch<{ enabled: boolean; off_since: string | null }>(`/wayra/group/${chatId}/status`)
        .then((status) => {
          setWayraStatus((prev) => ({ ...prev, [chatId]: status }));
        })
        .catch(() => {});
    }

    // Load restore messages (from Google Drive via backend endpoint)
    try {
      const restoreRes = await apiFetch<{ messages: Message[] }>(`/lounge/drive/restore/${chatId}`);
      if (restoreRes && restoreRes.messages) {
        setMessages((prev) => ({
          ...prev,
          [chatId]: restoreRes.messages,
        }));
      }
    } catch {}

    // Subscribe to real-time Firebase messages
    subscribeToFirebase(chatId);

    setSelectedChatId(chatId);
    setIsOpen(true);
    setShowNewChatOverlay(false);
    setShowSettingsOverlay(false);
  };

  const subscribeToFirebase = (chatId: string) => {
    const fb = firebaseInstance.current;
    if (!fb || !fb.ok || !fb.db) return;

    // Remove existing listener if any
    if (firebaseListeners.current[chatId]) {
      firebaseListeners.current[chatId]();
    }

    const messagesRef = ref(fb.db, `chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Message[] = Object.values(data);
        list.sort((a, b) => a.timestamp - b.timestamp);

        setMessages((prev) => {
          const current = prev[chatId] || [];
          // Merge lists by checking duplicate IDs
          const existingIds = new Set(current.map((m) => m.id));
          const newMsgs = list.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [chatId]: [...current, ...newMsgs],
          };
        });
      }
    });

    firebaseListeners.current[chatId] = () => off(messagesRef, "value", unsubscribe);
  };

  const handleCloseChatBox = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
    if (firebaseListeners.current[chatId]) {
      firebaseListeners.current[chatId]();
      delete firebaseListeners.current[chatId];
    }
  };

  const handleSend = async (chatId: string) => {
    const text = inputTexts[chatId]?.trim();
    if (!text || !currentUser) return;

    // Clear input first
    setInputTexts((prev) => ({ ...prev, [chatId]: "" }));

    const messageId = uuidv4();
    const timestamp = Date.now();
    
    const isWayraEnabled = wayraStatus[chatId]?.enabled !== false;
    const chat = chats.find((c) => c.id === chatId);
    const isGroup = chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id);

    const newMsg: Message = {
      id: messageId,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      text,
      timestamp,
      wayra_visible: isGroup ? isWayraEnabled : true,
    };

    // 1. Deliver instantly via Firebase RTDB
    const fb = firebaseInstance.current;
    if (fb && fb.ok && fb.db) {
      try {
        const msgRef = ref(fb.db, `chats/${chatId}/messages/${messageId}`);
        await set(msgRef, newMsg);
      } catch {}
    }

    // Update state locally
    setMessages((prev) => {
      const current = prev[chatId] || [];
      if (current.some((m) => m.id === messageId)) return prev;
      return {
        ...prev,
        [chatId]: [...current, newMsg],
      };
    });

    // 2. Perform background sync to backend drive cache
    try {
      const allMsgs = [...(messages[chatId] || []), newMsg];
      await apiFetch("/lounge/drive/sync", {
        method: "POST",
        body: JSON.stringify({
          chat_id: chatId,
          messages: allMsgs,
        }),
      });
    } catch {}

    // 3. Mentions & URL detection
    if (isGroup && chat) {
      const hasMention = text.toLowerCase().includes("@wayra");
      if (hasMention) {
        apiFetch<{ response: string | null }>(`/wayra/group/${chat.trip_id || chat.id}/mention`, {
          method: "POST",
          body: JSON.stringify({ message: text, chat_id: chatId }),
        }).catch(() => {});
      }

      // Detect URL
      apiFetch<{ is_travel_url: boolean; url: string }>("/wayra/group/detect-url", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      }).then(async (res) => {
        if (res.is_travel_url && fb && fb.ok && fb.db) {
          const extRes = await apiFetch<any>("/wayra/group/extract-location", {
            method: "POST",
            body: JSON.stringify({ url: res.url }),
          });
          if (extRes && extRes.place_name) {
            const previewMsgId = uuidv4();
            const previewText = `📍 Location detected: ${extRes.place_name} (${extRes.city || ""}, ${extRes.country || ""})`;
            const previewMsg: Message = {
              id: previewMsgId,
              sender_id: "wayra_ai",
              sender_name: "Wayra AI",
              text: previewText,
              timestamp: Date.now(),
              type: "location_preview",
              wayra_visible: true,
              location_details: extRes,
            };
            const msgRef = ref(fb.db, `chats/${chatId}/messages/${previewMsgId}`);
            await set(msgRef, previewMsg);
          }
        }
      }).catch(() => {});
    }
  };

  // Create Direct Chat
  const startDirectChat = async (targetUserId: string) => {
    try {
      const chat = await apiFetch<Chat>("/lounge/chats/direct", {
        method: "POST",
        body: JSON.stringify({ user_id: targetUserId }),
      });
      await fetchChats();
      handleThreadClick(chat.id);
      setActiveTab("chats");
    } catch {}
  };

  // Create Group Chat
  const createGroupChat = async () => {
    if (!groupName.trim() || selectedContactIds.length === 0) return;
    try {
      const chat = await apiFetch<Chat>("/lounge/chats/group", {
        method: "POST",
        body: JSON.stringify({
          name: groupName,
          member_ids: selectedContactIds,
        }),
      });
      await fetchChats();
      handleThreadClick(chat.id);
      setShowNewGroupModal(false);
      setGroupName("");
      setSelectedContactIds([]);
      setActiveTab("chats");
    } catch {}
  };

  // Update Settings
  const updateSettings = async (interval: string, wifi: boolean) => {
    setBackupInterval(interval);
    setWifiOnly(wifi);
    try {
      await apiFetch("/lounge/settings/backup", {
        method: "PATCH",
        body: JSON.stringify({ interval, wifi_only: wifi }),
      });
    } catch {}
  };

  // Helper function to generate client UUID
  const uuidv4 = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Filter lists based on search
  const filteredChats = chats.filter((c) => {
    if (!searchQuery) return true;
    const name = c.name || c.members.find((m) => m.user_id !== currentUser?.id)?.full_name || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    return c.full_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed bottom-0 right-[40px] z-[80] hidden md:flex items-end gap-3 pointer-events-none select-none">
      {/* MAIN DOCK WIDGET */}
      <div
        className={`bg-slate-900 text-white shadow-2xl rounded-t-xl flex flex-col border border-slate-700/50 pointer-events-auto select-text overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "w-[340px] md:w-[360px] h-[480px] md:h-[500px]" : "w-[290px] h-11"
        }`}
      >
        {/* Title bar (main or conversation) */}
        {!isOpen ? (
          <div
            className="h-11 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between cursor-pointer border-b border-slate-800/80 hover:bg-slate-800 w-full"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Rovvy Lounge
              </span>
            </div>
            <ChevronUp size={16} />
          </div>
        ) : selectedChatId ? (
          // Conversation Title Bar
          (() => {
            const chat = chats.find((c) => c.id === selectedChatId);
            const chatName = chat
              ? chat.name ||
                chat.members.find((m) => m.user_id !== currentUser?.id)?.full_name ||
                "Direct Chat"
              : "Chat";
            const chatAvatar = chatName.charAt(0);

            return (
              <div className="h-14 shrink-0 px-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedChatId(null)}
                    className="p-1 hover:bg-slate-805 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="h-7 w-7 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                    {chatAvatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate leading-tight">{chatName}</p>
                    <p className="text-[9px] text-white/50 font-medium leading-none mt-0.5">
                      {chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id) && wayraStatus[selectedChatId]?.enabled
                        ? "Wayra AI Active"
                        : "Lounge Ephemeral"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {chat && (chat.type === "group" || chat.type === "trip" || chat.trip_id) && wayraStatus[selectedChatId] && (
                    <button
                      type="button"
                      title={wayraStatus[selectedChatId].enabled ? "Disable Wayra AI (Privacy Mode)" : "Enable Wayra AI"}
                      onClick={() => toggleWayra(selectedChatId)}
                      className={`p-1.5 rounded transition-all duration-300 relative flex items-center justify-center ${
                        wayraStatus[selectedChatId].enabled
                          ? "text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/20"
                          : "text-stone-400 hover:text-stone-200 hover:bg-stone-500/20"
                      }`}
                    >
                      <Sparkles
                        size={14}
                        className={wayraStatus[selectedChatId].enabled ? "animate-pulse" : ""}
                      />
                      {wayraStatus[selectedChatId].enabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          // Main Title Bar
          <div className="h-14 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800/80">
            <div className="min-w-0">
              <p className="text-[14px] font-bold tracking-tight text-white leading-tight">
                Rovvy Lounge
              </p>
              <p className="text-[10px] font-medium text-white/60 leading-none mt-0.5">
                Messages, calls, and updates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsOverlay((prev) => !prev);
                  setShowNewChatOverlay(false);
                }}
                className={`p-1.5 rounded transition-colors ${
                  showSettingsOverlay ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
                title="Lounge Settings"
              >
                <Menu size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewChatOverlay((prev) => !prev);
                  setShowSettingsOverlay(false);
                  setActiveTab("chats");
                }}
                className={`p-1.5 rounded transition-colors ${
                  showNewChatOverlay ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
                title="New Chat"
              >
                <SquarePen size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        )}

        {isOpen && (
          <>
            {/* CONVERSATION VIEW MODE */}
            {selectedChatId ? (
              <div className="flex-1 flex flex-col min-h-0 bg-stone-50">
                {/* Chat Body / Message History */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-stone-50 text-[12px] flex flex-col justify-end min-h-0 relative">
                  <div className="overflow-y-auto space-y-2 max-h-full pr-1">
                    {(() => {
                      const chatMsgs = messages[selectedChatId] || [];
                      return chatMsgs.map((m) => {
                        const isUser = m.sender_id === currentUser?.id;
                        const isWayra = m.sender_id === "wayra_ai" || m.sender_avatar === "wayra";
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center gap-1 mb-0.5 text-[9px] font-medium">
                              {isWayra ? (
                                <span className="flex items-center gap-0.5 text-[#0F766E] font-bold">
                                  <Sparkles size={8} /> {m.sender_name}
                                </span>
                              ) : (
                                <span className="text-slate-900 font-bold">{isUser ? "You" : m.sender_name}</span>
                              )}
                              <span className="text-stone-500">·</span>
                              <span className="text-stone-500">
                                {new Date(m.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {m.wayra_visible === false && (
                                <span className="text-stone-400 text-[8px] flex items-center gap-0.5 font-bold" title="Private to members (Hidden from AI)">
                                  · 🔒 Private
                                </span>
                              )}
                            </div>
                            {m.type === "location_preview" && m.location_details ? (
                              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-sm max-w-[85%] text-slate-900">
                                {m.location_details.thumbnail && (
                                  <img
                                    src={m.location_details.thumbnail}
                                    alt={m.location_details.place_name || "Location"}
                                    className="w-full h-24 object-cover"
                                  />
                                )}
                                <div className="p-2.5">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-[#0F766E] mt-0.5">📍</span>
                                    <div>
                                      <h4 className="font-bold text-xs leading-snug">{m.location_details.place_name}</h4>
                                      <p className="text-[10px] text-stone-500 font-semibold">
                                        {[m.location_details.city, m.location_details.country].filter(Boolean).join(", ")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#0F766E] border-t border-stone-100 pt-2">
                                    <span>Confidence: {m.location_details.confidence}</span>
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${m.location_details.latitude},${m.location_details.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline"
                                    >
                                      View Map →
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`px-3 py-1.5 rounded-2xl max-w-[85%] leading-relaxed break-words font-medium shadow-sm ${
                                  isUser
                                    ? "bg-[#0F766E] text-white rounded-tr-none"
                                    : isWayra
                                    ? "bg-teal-50 text-teal-800 border border-teal-100 rounded-tl-none font-semibold"
                                    : "bg-white text-slate-900 border border-stone-200 rounded-tl-none"
                                }`}
                              >
                                {m.text}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Emoji Picker Overlay inside conversation body */}
                  {showEmojiPicker[selectedChatId] && (
                    <div className="absolute bottom-12 left-2 right-2 bg-white border border-stone-200 rounded-lg p-2 shadow-lg flex gap-2 justify-around z-50">
                      {["😊", "👍", "✈️", "🏨", "📍", "🚗", "🗺️", "🔥"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setInputTexts((prev) => ({
                              ...prev,
                              [selectedChatId]: (prev[selectedChatId] || "") + emoji,
                            }));
                            setShowEmojiPicker((prev) => ({ ...prev, [selectedChatId]: false }));
                          }}
                          className="text-lg hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input form */}
                <div className="p-2 border-t border-stone-200 bg-white flex items-center gap-1.5 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => alert("Attachments are currently disabled in ephemeral Lounge chat")}
                    className="text-stone-400 hover:text-stone-600 p-1 shrink-0"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => ({ ...prev, [selectedChatId]: !prev[selectedChatId] }))}
                    className="text-stone-400 hover:text-[#0F766E] p-1 shrink-0"
                    title="Emojis"
                  >
                    <Smile size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={inputTexts[selectedChatId] || ""}
                    onChange={(e) =>
                      setInputTexts((prev) => ({ ...prev, [selectedChatId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend(selectedChatId);
                    }}
                    className="flex-1 text-xs border border-stone-250 px-3 py-1.5 rounded-full outline-none focus:border-[#0F766E] text-slate-900 font-medium bg-stone-50"
                  />
                  {(inputTexts[selectedChatId] || "").trim() ? (
                    <button
                      type="button"
                      onClick={() => handleSend(selectedChatId)}
                      className="text-[#0F766E] hover:text-teal-700 p-1 shrink-0"
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert("Voice messaging coming soon")}
                      className="text-stone-400 hover:text-stone-600 p-1 shrink-0"
                      title="Microphone"
                    >
                      <Mic size={16} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // TAB LIST MODE
              <>
                {/* Search Bar - styled exactly like main Lounge search bar */}
                {!showSettingsOverlay && !showNewChatOverlay && (
                  <div className="bg-slate-950 px-3 py-2 shrink-0 border-b border-slate-800/60">
                    <div
                      className="flex h-9 w-full items-center gap-2 rounded-full px-3 text-left text-xs text-white/70 transition hover:bg-white/[0.18]"
                      style={{ background: "rgba(255,255,255,0.14)" }}
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-white/60" strokeWidth={2.5} />
                      <input
                        type="text"
                        placeholder={activeTab === "chats" ? "Search chats, people, and groups..." : "Search contacts..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent text-xs text-white w-full border-none outline-none placeholder:text-white/50"
                      />
                    </div>
                  </div>
                )}

                {/* Tab Bar - below search bar */}
                {!showSettingsOverlay && !showNewChatOverlay && (
                  <div className="bg-slate-950 px-2 pb-1.5 shrink-0 border-b border-slate-800/80">
                    <div className="flex bg-slate-900 p-0.5 rounded-lg text-xs font-semibold">
                      <button
                        onClick={() => setActiveTab("chats")}
                        className={`flex-1 py-1 rounded-md transition-all ${
                          activeTab === "chats" ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Chats
                      </button>
                      <button
                        onClick={() => setActiveTab("calls")}
                        className={`flex-1 py-1 rounded-md transition-all ${
                          activeTab === "calls" ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Calls
                      </button>
                      <button
                        onClick={() => setActiveTab("updates")}
                        className={`flex-1 py-1 rounded-md transition-all ${
                          activeTab === "updates" ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Updates
                      </button>
                    </div>
                  </div>
                )}

                {/* List Content */}
                <div className="flex-1 overflow-y-auto bg-white p-2 divide-y divide-stone-100">
                  {/* SETTINGS OVERLAY */}
                  {showSettingsOverlay && (
                    <div className="p-3 text-slate-900 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <span className="text-xs font-bold text-[#0F766E]">Lounge Settings</span>
                        <button
                          onClick={() => setShowSettingsOverlay(false)}
                          className="text-stone-400 hover:text-stone-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-[#0F766E] mb-2 flex items-center gap-1.5">
                          <Cloud size={14} />
                          <span>Google Drive Backup</span>
                        </h4>
                        <p className="text-[10px] text-stone-500 font-medium mb-3 leading-relaxed">
                          All messages are delivered in real-time and deleted from Rovvy servers. You can back up messages to your own Google Drive.
                        </p>

                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          Backup Interval
                        </label>
                        <select
                          value={backupInterval}
                          onChange={(e) => updateSettings(e.target.value, wifiOnly)}
                          className="w-full text-xs border border-stone-250 p-2 rounded-lg outline-none focus:border-[#0F766E] text-slate-900 font-semibold mb-3 bg-white"
                        >
                          <option value="6h">Every 6 Hours</option>
                          <option value="12h">Every 12 Hours</option>
                          <option value="24h">Daily (24 Hours)</option>
                        </select>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-stone-600">
                            Back up on Wi-Fi Only
                          </span>
                          <input
                            type="checkbox"
                            checked={wifiOnly}
                            onChange={(e) => updateSettings(backupInterval, e.target.checked)}
                            className="h-4 w-4 text-[#0F766E] focus:ring-[#0F766E] border-stone-300 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NEW CHAT / CONTACTS OVERLAY */}
                  {!showSettingsOverlay && activeTab === "chats" && showNewChatOverlay && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-2 mb-2 bg-slate-50 rounded-lg">
                        <span className="text-xs font-bold text-[#0F766E]">Start New Chat</span>
                        <button
                          onClick={() => setShowNewChatOverlay(false)}
                          className="text-stone-400 hover:text-stone-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Create Group Button */}
                      <button
                        onClick={() => setShowNewGroupModal(true)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs font-bold transition-all mb-2 border border-teal-100"
                      >
                        <Plus size={16} />
                        <span>Create Group Chat</span>
                      </button>

                      <div className="relative flex items-center mb-2">
                        <Search size={14} className="absolute left-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 text-xs text-slate-900 pl-8 pr-3 py-1.5 rounded-lg border border-stone-250 outline-none focus:border-[#0F766E] font-medium"
                        />
                      </div>

                      {filteredContacts.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-xs font-semibold">
                          No contacts found
                        </div>
                      ) : (
                        filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => {
                              startDirectChat(contact.id);
                              setShowNewChatOverlay(false);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                {contact.full_name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {contact.full_name}
                                </p>
                                <p className="text-[9px] text-stone-500 font-medium">
                                  @{contact.username || "user"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* CHATS TAB */}
                  {!showSettingsOverlay && !showNewChatOverlay && activeTab === "chats" && (
                    <>
                      {filteredChats.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-xs font-semibold animate-pulse">
                          No active chats
                        </div>
                      ) : (
                        filteredChats.map((c) => {
                          const name =
                            c.name ||
                            c.members.find((m) => m.user_id !== currentUser?.id)?.full_name ||
                            "Direct Chat";
                          const avatar = name.charAt(0);

                          return (
                            <div
                              key={c.id}
                              onClick={() => handleThreadClick(c.id)}
                              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                {avatar}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold text-slate-900 truncate">{name}</p>
                                  {c.type !== "direct" && (
                                    <span className="text-[8px] bg-teal-50 text-[#0F766E] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border border-teal-100">
                                      {c.type}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-stone-500 truncate mt-0.5 font-medium">
                                  {c.last_message_preview || "No messages yet"}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}

                  {/* CALLS TAB */}
                  {!showSettingsOverlay && activeTab === "calls" && (
                    <div className="space-y-3 p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                        Favorites
                      </p>
                      {filteredContacts.length === 0 ? (
                        <div className="text-center py-4 text-stone-400 text-xs font-semibold">
                          No favorites found
                        </div>
                      ) : (
                        filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between py-1.5 border-b border-stone-50"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center text-xs font-bold shrink-0">
                                {contact.full_name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {contact.full_name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => alert("Calls coming soon")}
                                className="p-1.5 text-[#0F766E] hover:bg-teal-50 rounded-full transition-colors"
                                title="Voice Call"
                              >
                                <Phone size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => alert("Calls coming soon")}
                                className="p-1.5 text-[#0F766E] hover:bg-teal-50 rounded-full transition-colors"
                                title="Video Call"
                              >
                                <Video size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}

                      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 pt-2">
                        Recent
                      </p>
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <p className="text-xs font-semibold text-slate-900">No recent calls</p>
                        <p className="text-[10px] text-stone-500 mt-0.5">Your call history will appear here</p>
                      </div>
                    </div>
                  )}

                  {/* UPDATES TAB */}
                  {!showSettingsOverlay && activeTab === "updates" && (
                    <div className="space-y-4 p-2">
                      <div className="flex items-center gap-3 py-2 border-b border-stone-100">
                        <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                          {currentUser?.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">My Status</p>
                          <p className="text-[10px] text-stone-500">No status updates</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-xs font-semibold text-stone-500 font-medium">No updates yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-text">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-stone-200 overflow-hidden animate-zoom-in animate-fade-in">
            <div className="bg-[#0F766E] p-3 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">New Group Chat</span>
              <button onClick={() => setShowNewGroupModal(false)} className="hover:bg-white/20 p-1 rounded">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-slate-900">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Summer Friends"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full text-xs border border-stone-250 p-2.5 rounded-lg outline-none focus:border-[#0F766E] text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-2">
                  Select Members
                </label>
                <div className="max-h-40 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg p-1">
                  {contacts.map((c) => {
                    const isSelected = selectedContactIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedContactIds(selectedContactIds.filter((id) => id !== c.id));
                          } else {
                            setSelectedContactIds([...selectedContactIds, c.id]);
                          }
                        }}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-900">{c.full_name}</span>
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-[#0F766E] border-[#0F766E]" : "border-stone-300"
                          }`}
                        >
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={createGroupChat}
                disabled={!groupName.trim() || selectedContactIds.length === 0}
                className="w-full bg-[#0F766E] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-all uppercase tracking-wider shadow-sm"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
