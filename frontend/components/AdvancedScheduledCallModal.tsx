"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  IconX,
  IconCalendar,
  IconClock,
  IconUsers,
  IconBell,
  IconPaperclip,
  IconImage,
  IconMic,
  IconDollarSign,
  IconSend,
  IconChevronDown,
  IconCheck,
  IconAlertCircle,
} from "./icons";
import { CallParticipantSelector, SelectableContact } from "./CallParticipantSelector";

export interface ScheduledCallData {
  id: string;
  title: string;
  description?: string;
  participants: string[];
  scheduledAt: string;
  reminders: number[]; // minutes before
  attachments: Attachment[];
  message?: string;
  status: "pending" | "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface Attachment {
  id: string;
  type: "image" | "video" | "audio" | "file" | "money";
  url?: string;
  name: string;
  size?: number;
  amount?: number; // for money
  currency?: string;
  note?: string;
}

const REMINDER_OPTIONS = [
  { label: "At time of call", value: 0 },
  { label: "5 minutes before", value: 5 },
  { label: "10 minutes before", value: 10 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "5 hours before", value: 300 },
  { label: "1 day before", value: 1440 },
];

interface AdvancedScheduledCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: SelectableContact[];
  onSchedule: (data: Omit<ScheduledCallData, "id" | "createdAt">) => void;
  currentUserId: string;
  existingCall?: ScheduledCallData | null;
}

export function AdvancedScheduledCallModal({
  isOpen,
  onClose,
  contacts,
  onSchedule,
  currentUserId,
  existingCall,
}: AdvancedScheduledCallModalProps) {
  const [step, setStep] = useState<"participants" | "details">("participants");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedReminders, setSelectedReminders] = useState<number[]>([10, 60]); // default: 10min + 1hr
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [message, setMessage] = useState("");
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (existingCall) {
        setSelectedIds(existingCall.participants);
        setTitle(existingCall.title);
        setDescription(existingCall.description || "");
        setScheduledAt(existingCall.scheduledAt);
        setSelectedReminders(existingCall.reminders);
        setAttachments(existingCall.attachments);
        setMessage(existingCall.message || "");
      } else {
        setStep("participants");
        setSelectedIds([]);
        setTitle("");
        setDescription("");
        setScheduledAt("");
        setSelectedReminders([10, 60]);
        setAttachments([]);
        setMessage("");
      }
    }
  }, [isOpen, existingCall]);

  // Generate preview URLs for images
  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    attachments.forEach((att) => {
      if (att.type === "image" && att.url && !previewUrls[att.id]) {
        newPreviews[att.id] = att.url;
      }
    });
    if (Object.keys(newPreviews).length > 0) {
      setPreviewUrls((prev) => ({ ...prev, ...newPreviews }));
    }
  }, [attachments, previewUrls]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.includes(c.id)),
    [contacts, selectedIds]
  );

  const toggleReminder = (minutes: number) => {
    setSelectedReminders((prev) =>
      prev.includes(minutes)
        ? prev.filter((m) => m !== minutes)
        : [...prev, minutes].sort((a, b) => a - b)
    );
  };

  const handleAddAttachment = (type: Attachment["type"]) => {
    const id = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (type === "money") {
      const amount = prompt("Enter amount:");
      const currency = prompt("Currency (e.g., USD, EUR):", "USD");
      const note = prompt("Add a note (optional):");
      if (amount) {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            type: "money",
            name: `Money: ${amount} ${currency || "USD"}`,
            amount: parseFloat(amount) || 0,
            currency: currency || "USD",
            note: note || undefined,
          },
        ]);
      }
    } else if (type === "image" || type === "video") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = type === "image" ? "image/*" : "video/*";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setAttachments((prev) => [
            ...prev,
            {
              id,
              type,
              name: file.name,
              url,
              size: file.size,
            },
          ]);
          if (type === "image") {
            setPreviewUrls((p) => ({ ...p, [id]: url }));
          }
        }
      };
      input.click();
    } else if (type === "audio") {
      // Placeholder for audio recording
      setAttachments((prev) => [
        ...prev,
        {
          id,
          type: "audio",
          name: `Voice message ${new Date().toLocaleTimeString()}`,
          url: "#", // Would be actual recording URL
        },
      ]);
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setAttachments((prev) => [
            ...prev,
            {
              id,
              type: "file",
              name: file.name,
              url: URL.createObjectURL(file),
              size: file.size,
            },
          ]);
        }
      };
      input.click();
    }
    setShowAttachmentMenu(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSubmit = () => {
    if (!title.trim() || !scheduledAt || selectedIds.length === 0) return;

    onSchedule({
      title: title.trim(),
      description: description.trim() || undefined,
      participants: selectedIds,
      scheduledAt,
      reminders: selectedReminders,
      attachments,
      message: message.trim() || undefined,
      status: "pending",
    });

    onClose();
  };

  const formatReminderLabel = (minutes: number) => {
    const option = REMINDER_OPTIONS.find((o) => o.value === minutes);
    return option?.label || `${minutes} minutes before`;
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      
      <div
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden"
        style={{
          background: "#1e2a3a",
          borderRadius: 20,
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#334155" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
              <IconCalendar size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {existingCall ? "Edit scheduled call" : "Schedule a call"}
              </h2>
              <p className="text-xs text-gray-400">
                {step === "participants" ? "Step 1: Select participants" : "Step 2: Set details & reminders"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === "details" && (
              <button
                onClick={() => setStep("participants")}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:text-white"
              >
                Back
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>

        {/* Step 1: Participants */}
        {step === "participants" && (
          <>
            <div className="travello-dark-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {/* Search */}
              <div className="mb-3 flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: "#334155", background: "#0f172a" }}>
                <IconUsers size={16} />
                <input
                  type="text"
                  placeholder="Search people and groups..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                  onChange={(e) => {
                    // Would filter contacts - simplified for now
                  }}
                />
              </div>

              {/* Selected count */}
              {selectedContacts.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedContacts.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-300"
                    >
                      {c.name}
                      <button
                        onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== c.id))}
                        className="rounded-full hover:bg-purple-500/30"
                      >
                        <IconX size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Contact list */}
              <div className="space-y-1">
                {contacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  const isGroup = contact.type === "group";
                  
                  return (
                    <button
                      key={contact.id}
                      onClick={() => {
                        setSelectedIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== contact.id)
                            : [...prev, contact.id]
                        );
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        isSelected ? "bg-purple-500/20" : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isGroup ? "bg-purple-500/20" : "bg-blue-500/20"}`}>
                        {isGroup ? (
                          <IconUsers size={20} />
                        ) : contact.avatar ? (
                          <img src={contact.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <IconUsers size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{contact.name}</p>
                        <p className="text-xs text-gray-500">
                          {isGroup ? `${contact.members?.length || 0} members` : "Individual"}
                        </p>
                      </div>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected ? "border-purple-500 bg-purple-500" : "border-gray-600"
                        }`}
                      >
                        {isSelected && <IconCheck size={14} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "#334155" }}>
              <span className="text-sm text-gray-400">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => setStep("details")}
                disabled={selectedIds.length === 0}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <>
            <div className="travello-dark-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* Title */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Call title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Weekly Team Sync, Travel Planning..."
                  className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                  style={{ borderColor: "#334155" }}
                />
              </div>

              {/* Date & Time */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <IconClock size={14} />
                    Date & Time
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={getMinDateTime()}
                  className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  style={{ borderColor: "#334155" }}
                />
              </div>

              {/* Reminders */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <IconBell size={14} />
                    Reminders
                  </span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowReminderDropdown(!showReminderDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-white"
                    style={{ borderColor: "#334155" }}
                  >
                    <span>
                      {selectedReminders.length === 0
                        ? "No reminders"
                        : selectedReminders.map(formatReminderLabel).join(", ")}
                    </span>
                    <IconChevronDown size={16} />
                  </button>
                  
                  {showReminderDropdown && (
                    <div
                      className="absolute z-20 mt-1 w-full rounded-lg border py-1 shadow-lg"
                      style={{ borderColor: "#334155", background: "#0f172a" }}
                    >
                      {REMINDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => toggleReminder(option.value)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                        >
                          <span>{option.label}</span>
                          {selectedReminders.includes(option.value) && (
                            <IconCheck size={16} active />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Participants will receive notifications at these times
                </p>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this call about?"
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                  style={{ borderColor: "#334155" }}
                />
              </div>

              {/* Attachments */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Attachments</label>
                
                {/* Attachment buttons */}
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAddAttachment("image")}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
                    style={{ borderColor: "#334155" }}
                  >
                    <IconImage size={14} />
                    Photo
                  </button>
                  <button
                    onClick={() => handleAddAttachment("video")}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
                    style={{ borderColor: "#334155" }}
                  >
                    <IconPaperclip size={14} />
                    Video
                  </button>
                  <button
                    onClick={() => handleAddAttachment("audio")}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
                    style={{ borderColor: "#334155" }}
                  >
                    <IconMic size={14} />
                    Audio
                  </button>
                  <button
                    onClick={() => handleAddAttachment("money")}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
                    style={{ borderColor: "#334155" }}
                  >
                    <IconDollarSign size={14} />
                    Amount
                  </button>
                  <button
                    onClick={() => handleAddAttachment("file")}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
                    style={{ borderColor: "#334155" }}
                  >
                    <IconPaperclip size={14} />
                    File
                  </button>
                </div>

                {/* Attachment list */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2"
                        style={{ borderColor: "#334155" }}
                      >
                        {att.type === "image" && previewUrls[att.id] ? (
                          <img
                            src={previewUrls[att.id]}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : att.type === "money" ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-yellow-500/20">
                            <IconDollarSign size={20} />
                          </div>
                        ) : att.type === "audio" ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-red-500/20">
                            <IconMic size={20} />
                          </div>
                        ) : att.type === "video" ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-green-500/20">
                            <IconPaperclip size={20} />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-500/20">
                            <IconPaperclip size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm text-white">{att.name}</p>
                          {att.amount !== undefined && (
                            <p className="text-xs text-yellow-400">
                              {att.amount} {att.currency}
                              {att.note && ` · ${att.note}`}
                            </p>
                          )}
                          {att.size && (
                            <p className="text-xs text-gray-500">
                              {(att.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                        >
                          <IconX size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message to participants */}
              <div className="mb-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Message to participants
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                  style={{ borderColor: "#334155" }}
                />
              </div>

              {/* Info box */}
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "#0f172a" }}
              >
                <IconAlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p className="text-gray-400">
                  This will create a pinned message in each participant&apos;s chat. 
                  They&apos;ll receive reminder notifications before the call starts. 
                  The call will automatically appear on their screen when it&apos;s time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "#334155" }}>
              <button
                onClick={() => setStep("participants")}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !scheduledAt}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                <IconSend size={16} />
                {existingCall ? "Update call" : "Schedule call"}
              </button>
            </div>
          </>
        )}
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
