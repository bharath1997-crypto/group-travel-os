"use client";

import React, { useState, useMemo } from "react";
import {
  IconSearch,
  IconX,
  IconUsers,
  IconUser,
  IconCheck,
  IconVideo,
  IconCalendar,
  IconShare,
} from "./icons";

export interface SelectableContact {
  id: string;
  name: string;
  avatar?: string | null;
  type: "individual" | "group";
  subtitle?: string;
  members?: string[];
  isOnline?: boolean;
}

interface CallParticipantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: SelectableContact[];
  mode: "start" | "link" | "schedule";
  onConfirm: (selectedIds: string[], message?: string) => void;
  currentUserId: string;
}

export function CallParticipantSelector({
  isOpen,
  onClose,
  contacts,
  mode,
  onConfirm,
  currentUserId,
}: CallParticipantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [showMessageComposer, setShowMessageComposer] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.includes(c.id)),
    [contacts, selectedIds]
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds, message || undefined);
    setSelectedIds([]);
    setMessage("");
    setShowMessageComposer(false);
    setSearchQuery("");
  };

  if (!isOpen) return null;

  const modeConfig = {
    start: { icon: IconVideo, title: "Start a call", buttonText: "Start call", color: "#10b981" },
    link: { icon: IconShare, title: "New call link", buttonText: "Generate link & send", color: "#3b82f6" },
    schedule: { icon: IconCalendar, title: "Schedule a call", buttonText: "Continue to schedule", color: "#8b5cf6" },
  };

  const config = modeConfig[mode];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden"
        style={{
          background: "#1e2a3a",
          borderRadius: 16,
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#334155" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: config.color }}
            >
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{config.title}</h3>
              <p className="text-xs text-gray-400">
                {selectedIds.length === 0
                  ? "Select people to include"
                  : `${selectedIds.length} selected`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Selected chips */}
        {selectedContacts.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b px-4 py-2" style={{ borderColor: "#334155", background: "#0f172a" }}>
            {selectedContacts.map((contact) => (
              <span
                key={contact.id}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                style={{ background: config.color + "30", color: "#fff" }}
              >
                {contact.name}
                <button
                  onClick={() => toggleSelection(contact.id)}
                  className="ml-1 rounded-full hover:bg-white/20"
                >
                  <IconX size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-2"
            style={{ background: "#0f172a" }}
          >
            <IconSearch size={16} />
            <input
              type="text"
              placeholder="Search people and groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="travello-dark-scrollbar min-h-0 flex-1 overflow-y-auto px-2">
          {filteredContacts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No contacts found
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {filteredContacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                const isGroup = contact.type === "group";

                return (
                  <button
                    key={contact.id}
                    onClick={() => toggleSelection(contact.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isGroup ? "bg-purple-500/20" : "bg-blue-500/20"
                      }`}
                    >
                      {isGroup ? (
                        <IconUsers size={20} />
                      ) : contact.avatar ? (
                        <img
                          src={contact.avatar}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <IconUser size={20} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {contact.name}
                        </span>
                        {contact.isOnline && !isGroup && (
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {isGroup
                          ? `${contact.members?.length || 0} members`
                          : contact.subtitle || "Available for calls"}
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                        isSelected
                          ? "border-transparent"
                          : "border-gray-600"
                      }`}
                      style={{ background: isSelected ? config.color : "transparent" }}
                    >
                      {isSelected && <IconCheck size={16} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Message composer (for link mode) */}
        {(mode === "link" || mode === "schedule") && selectedIds.length > 0 && (
          <div className="border-t px-4 py-3" style={{ borderColor: "#334155" }}>
            <button
              onClick={() => setShowMessageComposer(!showMessageComposer)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white"
            >
              {showMessageComposer ? "▼" : "▶"} Add a message (optional)
            </button>
            {showMessageComposer && (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Add a message to send with your ${mode === "link" ? "call link" : "scheduled call"}...`}
                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
                style={{ borderColor: "#334155", minHeight: 80, resize: "vertical" }}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "#334155" }}>
          <span className="text-xs text-gray-500">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: config.color }}
            >
              <Icon size={16} />
              {config.buttonText}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .travello-dark-scrollbar {
          scrollbar-color: rgba(148, 163, 184, 0.75) #1e2a3a;
          scrollbar-width: thin;
        }

        .travello-dark-scrollbar::-webkit-scrollbar {
          width: 10px;
        }

        .travello-dark-scrollbar::-webkit-scrollbar-track {
          background: #1e2a3a;
        }

        .travello-dark-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.75);
          border: 2px solid #1e2a3a;
          border-radius: 9999px;
        }

        .travello-dark-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(203, 213, 225, 0.9);
        }
      `}</style>
    </div>
  );
}
