"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  ChevronUp,
  ChevronDown,
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
  text: string;
  timestamp: number;
};

export function LoungeDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openChatBoxes, setOpenChatBoxes] = useState<string[]>([]); // active chat IDs (max 3)
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);

  // Search & Navigation
  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "settings">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Backup Settings
  const [backupInterval, setBackupInterval] = useState("24h");
  const [wifiOnly, setWifiOnly] = useState(true);

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
      // AI companion fallback
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

  const handleThreadClick = async (chatId: string) => {
    if (!openChatBoxes.includes(chatId)) {
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

      // Limit to max 3 side-by-side chats to keep it neat
      setOpenChatBoxes((prev) => {
        if (prev.length >= 3) {
          return [...prev.slice(1), chatId];
        }
        return [...prev, chatId];
      });

      // Subscribe to real-time Firebase messages
      subscribeToFirebase(chatId);
    }
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
    setOpenChatBoxes(openChatBoxes.filter((id) => id !== chatId));
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

    const newMsg: Message = {
      id: messageId,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      text,
      timestamp,
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
      {/* 1. DOCKED CHAT WINDOWS (OPEN SIDE-BY-SIDE) */}
      {openChatBoxes.map((chatId) => {
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) return null;

        const chatName =
          chat.name ||
          chat.members.find((m) => m.user_id !== currentUser?.id)?.full_name ||
          "Direct Chat";

        const chatAvatar = chatName.charAt(0);
        const chatMsgs = messages[chatId] || [];
        const inputText = inputTexts[chatId] || "";

        return (
          <div
            key={chatId}
            className="w-[290px] h-[360px] bg-white rounded-t-xl shadow-2xl border border-stone-200 flex flex-col pointer-events-auto select-text overflow-hidden animate-slide-up"
          >
            {/* Header */}
            <div
              className="h-11 shrink-0 bg-[#0F766E] text-white px-3 flex items-center justify-between cursor-pointer rounded-t-xl"
              onClick={(e) => handleCloseChatBox(chatId, e)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full bg-teal-850 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {chatAvatar}
                </div>
                <span className="text-xs font-bold truncate">{chatName}</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleCloseChatBox(chatId, e)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Chat Body / Message History */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-stone-50 text-[12px] flex flex-col justify-end">
              <div className="overflow-y-auto space-y-2 max-h-full pr-1">
                {chatMsgs.map((m) => {
                  const isUser = m.sender_id === currentUser?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5 text-[9px] text-stone-500 font-medium">
                        <span>{isUser ? "You" : m.sender_name}</span>
                        <span>·</span>
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-2xl max-w-[85%] leading-relaxed break-words font-medium shadow-sm ${
                          isUser
                            ? "bg-[#0F766E] text-white rounded-tr-none"
                            : "bg-white text-stone-850 border border-stone-200 rounded-tl-none"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input form */}
            <div className="p-2 border-t border-stone-100 bg-white flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="text-stone-400 hover:text-stone-600 p-1"
                title="Attach file"
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) =>
                  setInputTexts((prev) => ({ ...prev, [chatId]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend(chatId);
                }}
                className="flex-1 text-xs border border-stone-250 px-2.5 py-1.5 rounded-full outline-none focus:border-[#0F766E] text-stone-850 font-medium"
              />
              <button
                type="button"
                className="text-stone-400 hover:text-stone-600 p-1"
                title="Microphone"
              >
                <Mic size={16} />
              </button>
              <button
                type="button"
                className="text-stone-400 hover:text-stone-600 p-1"
                title="Emoji"
              >
                <Smile size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleSend(chatId)}
                disabled={!inputText.trim()}
                className="bg-[#0F766E] text-white p-1.5 rounded-full hover:bg-teal-700 disabled:opacity-40 transition-opacity flex items-center justify-center shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        );
      })}

      {/* 2. COLLAPSED MAIN DOCK PILL (LinkedIn messaging drawer style) */}
      <div
        className={`w-[290px] bg-slate-900 text-white shadow-2xl rounded-t-xl flex flex-col border border-slate-700/50 pointer-events-auto select-text overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "h-[420px]" : "h-11"
        }`}
      >
        {/* Main Title bar */}
        <div
          className="h-11 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between cursor-pointer border-b border-slate-800/80 hover:bg-slate-800"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Rovvy Lounge</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        </div>

        {isOpen && (
          <>
            {/* Tabs & Search */}
            <div className="bg-slate-950 p-2 shrink-0 space-y-2 border-b border-slate-800">
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
                  onClick={() => setActiveTab("contacts")}
                  className={`flex-1 py-1 rounded-md transition-all ${
                    activeTab === "contacts" ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Contacts
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex-1 py-1 rounded-md transition-all ${
                    activeTab === "settings" ? "bg-[#0F766E] text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Settings
                </button>
              </div>

              {activeTab !== "settings" && (
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 text-xs text-white pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#0F766E] font-medium"
                  />
                </div>
              )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto bg-white p-2 divide-y divide-stone-100">
              {/* CHATS TAB */}
              {activeTab === "chats" && (
                <>
                  {filteredChats.length === 0 ? (
                    <div className="text-center py-8 text-stone-400 text-xs font-semibold">
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
                              <p className="text-xs font-bold text-stone-850 truncate">{name}</p>
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

              {/* CONTACTS TAB */}
              {activeTab === "contacts" && (
                <div className="space-y-1">
                  {/* Create Group Button */}
                  <button
                    onClick={() => setShowNewGroupModal(true)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs font-bold transition-all mb-2 border border-teal-100"
                  >
                    <Plus size={16} />
                    <span>Create Group Chat</span>
                  </button>

                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-stone-400 text-xs font-semibold">
                      No contacts found
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => startDirectChat(contact.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                            {contact.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-stone-850 truncate">
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

              {/* SETTINGS TAB */}
              {activeTab === "settings" && (
                <div className="p-3 text-stone-800 space-y-4">
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
                      className="w-full text-xs border border-stone-250 p-2 rounded-lg outline-none focus:border-[#0F766E] text-stone-850 font-semibold mb-3 bg-white"
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
            </div>
          </>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-text">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-stone-200 overflow-hidden animate-zoom-in">
            <div className="bg-[#0F766E] p-3 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">New Group Chat</span>
              <button onClick={() => setShowNewGroupModal(false)} className="hover:bg-white/20 p-1 rounded">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-stone-800">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Summer Friends"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full text-xs border border-stone-250 p-2.5 rounded-lg outline-none focus:border-[#0F766E] text-stone-850 font-medium"
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
                        <span className="text-xs font-bold text-stone-800">{c.full_name}</span>
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
