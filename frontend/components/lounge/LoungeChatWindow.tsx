"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Send,
  Search,
  Paperclip,
  Mic,
  Smile,
  Sparkles,
  Reply,
  Video,
  Calendar,
  BellOff,
  Users,
  Ban,
  CheckCheck,
} from "lucide-react";
import WayraIcon from "@/components/ui/WayraIcon";
import { RovvyHelpPanel } from "@/components/lounge/RovvyHelpPanel";
import { CommunityUpdatesPanel } from "@/components/lounge/CommunityUpdatesPanel";
import { DemoDmChatPanel, type DemoChatView } from "@/components/lounge/DemoDmChatPanel";
import { ChatEmojiGifPicker } from "@/components/lounge/ChatEmojiGifPicker";
import { WhatsAppAttachMiniMenu } from "@/components/lounge/chat/TravelHubChat";
import { GroupInfoPanel } from "@/components/lounge/hub/GroupInfoPanel";
import { DmInfoPanel } from "@/components/lounge/hub/DmInfoPanel";
import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  ThIconMoreDots,
  ThIconPhoneHandset,
  ThIconSearch,
} from "@/components/lounge/hub/HubIcons";
import {
  DEMO_CHAT_COMMUNITY_ID,
  DEMO_CHAT_ROVVY_HELP_ID,
  QUICK_REACTION_CHIPS,
} from "@/lib/lounge/constants";
import { isDemoChatId } from "@/lib/lounge/demo-contacts";
import type { ChatInfo, ContactPerson, GroupOut } from "@/lib/lounge/hub-types";
import type { ChatPrefs } from "@/lib/lounge/chat-prefs";
import {
  chatRowDmAvatarUrl,
  initialsFromName,
  listAvatarColor,
  loungeChatDisplayName,
} from "@/lib/lounge/hub-utils";
import { ref, onValue, set, remove, type Database } from "firebase/database";

export type LoungeChatMessage = {
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
  metadata?: Record<string, unknown>;
};

type LoungeChatWindowProps = {
  chatId: string;
  chatInfo: ChatInfo | null;
  demoChatView?: DemoChatView | null;
  groups: GroupOut[];
  contacts: ContactPerson[];
  chatPrefs: Record<string, ChatPrefs>;
  currentUser: { id: string; full_name: string } | null;
  messages: LoungeChatMessage[];
  inputText: string;
  onInputTextChange: (value: string) => void;
  onClose: () => void;
  minimized: boolean;
  onToggleMinimized: () => void;
  onSend: (replyTo?: LoungeChatMessage | null) => void;
  onSendAttachment: (type: string, text: string, metadata?: Record<string, unknown>) => void;
  onFileSelect: (file: File, type: "image" | "video" | "document") => void;
  onShareLocation: () => void;
  onStarMessage: (msg: LoungeChatMessage) => void;
  onBlockUser: () => void;
  onLeaveGroupSuccess: (groupId: string) => void;
  onOpenSplit: () => void;
  onToggleWayra: () => void;
  onToast: (msg: string) => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall: () => void;
  onOpenDirectChat: (p: ContactPerson) => void;
  onClearChat: () => void;
  onToggleFavorite: () => void;
  onToggleMute: () => void;
  reloadGroups: () => Promise<GroupOut[] | null>;
  handleUnauthorized: () => void;
  masterAbortRef: React.MutableRefObject<AbortController | null>;
  scheduleVersion: number;
  onScheduleChanged: () => void;
  peerOnline: boolean | null;
  wayraStatus?: { enabled: boolean; off_since: string | null };
  isGroup: boolean;
  firebaseDb: Database | null;
  isRecording: boolean;
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: (cancel: boolean) => void;
  onTyping: () => void;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

export function LoungeChatWindow({
  chatId,
  chatInfo,
  demoChatView,
  groups,
  contacts,
  chatPrefs,
  currentUser,
  messages,
  inputText,
  onInputTextChange,
  onClose,
  minimized,
  onToggleMinimized,
  onSend,
  onSendAttachment,
  onFileSelect,
  onShareLocation,
  onStarMessage,
  onBlockUser,
  onLeaveGroupSuccess,
  onOpenSplit,
  onToggleWayra,
  onToast,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onOpenDirectChat,
  onClearChat,
  onToggleFavorite,
  onToggleMute,
  reloadGroups,
  handleUnauthorized,
  masterAbortRef,
  scheduleVersion,
  onScheduleChanged,
  peerOnline,
  wayraStatus,
  isGroup,
  firebaseDb,
  isRecording,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onTyping,
  longPressTimerRef,
}: LoungeChatWindowProps) {
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [replyTo, setReplyTo] = useState<LoungeChatMessage | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [emojiGifPickerOpen, setEmojiGifPickerOpen] = useState(false);
  const [emojiGifPickerTab, setEmojiGifPickerTab] = useState<"emoji" | "gif" | "stickers">("emoji");
  const [attachMiniOpen, setAttachMiniOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHelp = chatId === DEMO_CHAT_ROVVY_HELP_ID;
  const isCommunity = chatId === DEMO_CHAT_COMMUNITY_ID;
  const chatName = loungeChatDisplayName(chatInfo, {
    selfId: currentUser?.id,
    selfName: currentUser?.full_name,
    groups,
  });
  const groupMeta = chatInfo?.group_id
    ? groups.find((g) => g.id === chatInfo.group_id)
    : undefined;
  const memberCount =
    groupMeta?.members?.length ?? chatInfo?.members?.length ?? 0;
  const isSelfChat =
    chatInfo?.type === "individual" &&
    !isHelp &&
    !isCommunity &&
    !isDemoChatId(chatId) &&
    (!chatInfo.members.find((m) => m !== currentUser?.id) ||
      chatInfo.members.every((m) => m === currentUser?.id));

  useEffect(() => {
    if (!attachMiniOpen) return;
    const close = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMiniOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [attachMiniOpen]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [headerMenuOpen]);

  useEffect(() => {
    if (!firebaseDb || !currentUser || isHelp || isCommunity || isDemoChatId(chatId)) {
      setTypingUsers([]);
      return;
    }
    const typingRef = ref(firebaseDb, `chats/${chatId}/typing`);
    const unsub = onValue(typingRef, (snapshot) => {
      const typing: string[] = [];
      snapshot.forEach((child) => {
        if (child.key !== currentUser.id && child.val()) {
          typing.push(String(child.val()));
        }
      });
      setTypingUsers(typing);
    });
    return () => unsub();
  }, [firebaseDb, chatId, currentUser, isHelp, isCommunity]);

  const handleLocalTyping = () => {
    if (!firebaseDb || !currentUser || isHelp || isCommunity || isDemoChatId(chatId)) return;
    const r = ref(firebaseDb, `chats/${chatId}/typing/${currentUser.id}`);
    void set(r, currentUser.full_name || "Someone");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void remove(r).catch(() => {});
    }, 2000);
    onTyping();
  };

  const filteredMessages = useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(q));
  }, [messages, inChatSearchQuery]);

  const openProfile = () => {
    if (isHelp || isCommunity || isDemoChatId(chatId)) return;
    if (minimized) onToggleMinimized();
    setShowProfilePanel(true);
  };

  const renderProfileOverlay = () => {
    if (!showProfilePanel || !chatInfo || !currentUser) return null;
    if (chatInfo.type === "group" && chatInfo.group_id) {
      return (
        <aside className="absolute inset-0 z-[60] flex flex-col bg-[#1E293B]">
          <GroupInfoPanel
            key={chatInfo.group_id}
            group={
              groups.find((x) => x.id === chatInfo.group_id) ?? {
                id: chatInfo.group_id,
                name: chatName,
                description: null,
                members: [],
              }
            }
            selfId={currentUser.id}
            onClose={() => setShowProfilePanel(false)}
            onSearchInGroupChat={() => {
              setShowProfilePanel(false);
              setInChatSearchOpen(true);
            }}
            openDirectChat={onOpenDirectChat}
            onLeaveSuccess={onLeaveGroupSuccess}
            showToast={onToast}
            onUnauthorized={handleUnauthorized}
            loadBackend={() => void reloadGroups()}
            onViewFullSplit={() => {
              setShowProfilePanel(false);
              onOpenSplit();
            }}
            onSettleAll={() => onToast("Open Split in chat to settle expenses")}
            masterAbortRef={masterAbortRef}
            onVoiceCall={onVoiceCall}
            onVideoCall={onVideoCall}
            onScheduleCall={onScheduleCall}
            onClearChat={onClearChat}
            onToggleFavorite={onToggleFavorite}
            isFavorite={chatPrefs[chatId]?.favorite ?? false}
            scheduleVersion={scheduleVersion}
            onScheduleChanged={onScheduleChanged}
          />
        </aside>
      );
    }
    if (chatInfo.type === "individual" && !isSelfChat) {
      const peerId = chatInfo.members.find((m) => m !== currentUser.id);
      const peer = peerId ? contacts.find((c) => c.id === peerId) : null;
      return (
        <aside className="absolute inset-0 z-[60] flex flex-col bg-[#1E293B]">
          <DmInfoPanel
            key={chatId}
            chatId={chatId}
            peerName={chatName}
            peerUsername={peer?.username ?? null}
            peerAvatarUrl={chatRowDmAvatarUrl(chatInfo)}
            peerOnline={peerOnline}
            isFavorite={chatPrefs[chatId]?.favorite ?? false}
            isMuted={chatPrefs[chatId]?.muted ?? false}
            onClose={() => setShowProfilePanel(false)}
            onSearchInChat={() => {
              setShowProfilePanel(false);
              setInChatSearchOpen(true);
            }}
            onVoiceCall={onVoiceCall}
            onVideoCall={onVideoCall}
            onScheduleCall={onScheduleCall}
            onClearChat={onClearChat}
            onBlockPeer={onBlockUser}
            onReport={() => onToast("Report submitted — thank you")}
            onToggleFavorite={onToggleFavorite}
            onToggleMute={onToggleMute}
            onViewFullProfile={() => onToast("Open full profile from Travel Hub")}
            scheduleVersion={scheduleVersion}
            onScheduleChanged={onScheduleChanged}
          />
        </aside>
      );
    }
    if (isSelfChat) {
      return (
        <aside className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#1E293B] p-6 text-center text-white">
          <InitialsAvatar name={chatName} size={80} />
          <p className="text-lg font-bold">{chatName}</p>
          <p className="text-sm text-white/60">
            Your private note — send messages to yourself (like WhatsApp). No replies.
          </p>
          <button
            type="button"
            onClick={() => setShowProfilePanel(false)}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold"
          >
            Back to chat
          </button>
        </aside>
      );
    }
    return null;
  };

  const renderBody = () => {
    if (isHelp) return <RovvyHelpPanel compact />;
    if (isCommunity) return <CommunityUpdatesPanel />;
    if (isDemoChatId(chatId) && demoChatView) {
      return (
        <DemoDmChatPanel chat={demoChatView} onBack={onClose} onToast={onToast} />
      );
    }

    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-stone-50">
        {renderProfileOverlay()}
        {inChatSearchOpen ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
            <Search size={14} className="shrink-0 text-stone-400" />
            <input
              type="text"
              value={inChatSearchQuery}
              onChange={(e) => setInChatSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 text-xs text-slate-900 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setInChatSearchOpen(false);
                setInChatSearchQuery("");
              }}
              className="text-stone-400"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {replyTo ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-teal-50 px-3 py-1.5 text-[10px]">
            <Reply size={12} className="shrink-0 text-primary" />
            <span className="flex-1 truncate text-slate-700">
              Replying to <strong>{replyTo.sender_name}</strong>: {replyTo.text.slice(0, 40)}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-stone-400">
              <X size={12} />
            </button>
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col justify-end overflow-y-auto bg-stone-50 p-3 text-[12px]">
          <div className="max-h-full space-y-2 overflow-y-auto pr-1">
            {filteredMessages.map((m) => {
              const isUser = m.sender_id === currentUser?.id;
              const isWayra = m.sender_id === "wayra_ai" || m.sender_avatar === "wayra";
              return (
                <div
                  key={m.id}
                  className={`group flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMessageMenuId(m.id);
                  }}
                >
                  <div className="mb-0.5 flex items-center gap-1 text-[9px] font-medium">
                    <span className="font-bold text-slate-900">
                      {isUser ? "You" : isWayra ? m.sender_name : m.sender_name}
                    </span>
                    <span className="text-stone-500">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isUser && !m.type ? (
                      <CheckCheck size={10} className="text-teal-600" aria-label="Sent" />
                    ) : null}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 font-medium leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-tr-none bg-primary text-white"
                        : "rounded-tl-none border border-stone-200 bg-white text-slate-900"
                    }`}
                  >
                    {m.text}
                  </div>
                  {messageMenuId === m.id ? (
                    <div className="mt-0.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(m);
                          setMessageMenuId(null);
                        }}
                        className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => onStarMessage(m)}
                        className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600"
                      >
                        Star
                      </button>
                      {!isGroup && !isSelfChat ? (
                        <button
                          type="button"
                          onClick={() => void onBlockUser()}
                          className="rounded border border-red-200 bg-white px-2 py-0.5 text-[9px] font-bold text-red-600"
                        >
                          Block
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setMessageMenuId(null)}
                        className="rounded px-1 py-0.5 text-[9px] text-stone-400"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {typingUsers.length > 0 ? (
            <div className="shrink-0 px-3 py-1 text-[10px] italic font-medium text-stone-500">
              {typingUsers[0]} is typing…
            </div>
          ) : null}
          <div className="absolute bottom-0 left-0 right-0">
            <ChatEmojiGifPicker
              open={emojiGifPickerOpen}
              tab={emojiGifPickerTab}
              onTabChange={setEmojiGifPickerTab}
              panelHeightPx={180}
              onClose={() => setEmojiGifPickerOpen(false)}
              onInsertEmoji={(em) => onInputTextChange(inputText + em)}
              onPickGifUrl={(url) => {
                void onSendAttachment("gif", url);
                setEmojiGifPickerOpen(false);
              }}
              onPickSticker={(sticker) => {
                void onSendAttachment("sticker", sticker, { sticker });
                setEmojiGifPickerOpen(false);
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-stone-100 bg-white px-2 py-1 no-scrollbar">
          {QUICK_REACTION_CHIPS.slice(0, 6).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onInputTextChange(chip)}
              className="shrink-0 rounded-full border border-stone-200 px-2 py-0.5 text-[9px] font-semibold text-slate-600 hover:bg-stone-50"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 border-t border-stone-200 bg-white p-2">
          <div className="relative shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setAttachMiniOpen((o) => !o)}
              className="p-1 text-stone-400 hover:text-stone-600"
              title="Attach"
            >
              <Paperclip size={16} />
            </button>
            {attachMiniOpen ? (
              <WhatsAppAttachMiniMenu
                align="left"
                includeTravelActions={isGroup}
                onClose={() => setAttachMiniOpen(false)}
                onCamera={() =>
                  onToast("Use Gallery to upload a photo for now.")
                }
                onGalleryFile={(file) => {
                  void onFileSelect(
                    file,
                    file.type.startsWith("video") ? "video" : "image",
                  );
                }}
                onDocumentFile={(file) => void onFileSelect(file, "document")}
                onAudio={onStartRecording}
                onLocation={() => {
                  onShareLocation();
                  setAttachMiniOpen(false);
                }}
                onContact={() => onToast("Contact sharing coming soon")}
                onPoll={() => onToast("Polls are next in the chat roadmap")}
                onEvent={() => onToast("Event sharing coming soon")}
                onSplit={onOpenSplit}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setEmojiGifPickerOpen((o) => !o)}
            className="shrink-0 p-1 text-stone-400 hover:text-primary"
          >
            <Smile size={16} />
          </button>
          <input
            type="text"
            placeholder={isSelfChat ? "Note to yourself…" : "Type a message…"}
            value={inputText}
            onChange={(e) => {
              onInputTextChange(e.target.value);
              handleLocalTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend(replyTo);
            }}
            className="flex-1 rounded-full border border-stone-250 bg-stone-50 px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-primary"
          />
          {isRecording ? (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[10px] font-bold text-red-600">{recordingDuration}s</span>
              <button type="button" onClick={() => onStopRecording(true)} className="p-1 text-[10px] font-bold text-red-500">
                ✕
              </button>
              <button type="button" onClick={() => onStopRecording(false)} className="p-1 text-primary">
                <Send size={16} />
              </button>
            </div>
          ) : inputText.trim() ? (
            <button type="button" onClick={() => onSend(replyTo)} className="shrink-0 p-1 text-primary">
              <Send size={16} />
            </button>
          ) : (
            <button
              type="button"
              onMouseDown={() => onStartRecording()}
              className="shrink-0 p-1 text-stone-400 hover:text-stone-600"
            >
              <Mic size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const headerIni = initialsFromName(chatName);
  const headerBg = listAvatarColor(chatName);

  return (
    <div
      className={`pointer-events-auto flex w-[340px] flex-col overflow-hidden rounded-t-xl border border-slate-700/50 bg-slate-900 text-white shadow-2xl transition-all duration-200 md:w-[360px] ${
        minimized ? "h-11" : "h-[480px] md:h-[500px]"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-between border-b border-slate-800/80 px-2 ${
          minimized ? "h-11 cursor-pointer hover:bg-slate-800/60" : "h-14"
        }`}
      >
        <button
          type="button"
          onClick={onToggleMinimized}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={minimized ? "Open chat" : "Minimize chat"}
        >
          {isHelp ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
              <WayraIcon state="flying" size={0.45} variant="navy" animate={false} />
            </span>
          ) : isCommunity ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold">
              CU
            </div>
          ) : chatInfo?.type === "individual" && chatRowDmAvatarUrl(chatInfo) ? (
            <img
              src={chatRowDmAvatarUrl(chatInfo)!}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: headerBg }}
            >
              {headerIni}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold leading-tight">{chatName}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-none text-white/50">
              {isHelp
                ? "AI Assistant · always online"
                : isCommunity
                  ? "Official channel · read only"
                  : isSelfChat
                    ? "Note to yourself"
                    : isGroup
                      ? `${memberCount} member${memberCount === 1 ? "" : "s"} · tap for info`
                      : peerOnline
                        ? "Active now"
                        : "Connected"}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {!minimized && !isHelp && !isCommunity && !isDemoChatId(chatId) ? (
            <>
              <button
                type="button"
                onClick={() => setInChatSearchOpen((o) => !o)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Search"
              >
                <ThIconSearch size={16} className="text-current" />
              </button>
              {!isSelfChat ? (
                <>
                  <button
                    type="button"
                    onClick={onVoiceCall}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Voice call"
                  >
                    <ThIconPhoneHandset size={16} className="text-current" />
                  </button>
                  <button
                    type="button"
                    onClick={onVideoCall}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Video call"
                  >
                    <Video size={15} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={onScheduleCall}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Schedule call"
                  >
                    <Calendar size={15} strokeWidth={1.5} />
                  </button>
                </>
              ) : null}
              <div className="relative" ref={headerMenuRef}>
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((o) => !o)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="More"
                >
                  <ThIconMoreDots size={16} className="text-current" />
                </button>
                {headerMenuOpen ? (
                  <div className="absolute right-0 top-full z-[80] mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        openProfile();
                      }}
                    >
                      <Users size={14} /> {isGroup ? "Group info" : "Chat info"}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        onToggleMute();
                      }}
                    >
                      <BellOff size={14} /> Mute
                    </button>
                    {!isSelfChat ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-white/10"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          onBlockUser();
                        }}
                      >
                        <Ban size={14} /> Block
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {!minimized && isGroup && wayraStatus ? (
            <button
              type="button"
              title={wayraStatus.enabled ? "Disable Wayra AI" : "Enable Wayra AI"}
              onClick={onToggleWayra}
              className={`rounded p-1.5 ${wayraStatus.enabled ? "text-emerald-300" : "text-stone-400"}`}
            >
              <Sparkles size={14} className={wayraStatus.enabled ? "animate-pulse" : ""} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {!minimized ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-50">
          {renderBody()}
        </div>
      ) : null}
    </div>
  );
}
