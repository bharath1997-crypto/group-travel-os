"use client";

import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { minutesAgo } from "@/lib/live/types";

type ChatMessage = {
  id: string;
  text: string;
  sender_label: string;
  sent_at: string;
};

const DRIVE_SESSION_KEY = "rovvy_drive_session";

function getDriveSessionKey(): string {
  const existing = sessionStorage.getItem(DRIVE_SESSION_KEY);
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem(DRIVE_SESSION_KEY, key);
  return key;
}

function timeAgo(iso: string): string {
  const mins = minutesAgo(iso);
  if (mins === 0) return "just now";
  return `${mins}m ago`;
}

interface ChatSlidePanelProps {
  chatOpen: boolean;
  chatTarget: { id: string; label: string; type: "traveler" | "report" } | null;
  onBack: () => void;
  onToast?: (message: string) => void;
}

export function ChatSlidePanel({
  chatOpen,
  chatTarget,
  onBack,
  onToast,
}: ChatSlidePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const sessionKeyRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionKeyRef.current = getDriveSessionKey();
  }, []);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!chatTarget) return;
      if (!silent) setLoading(true);
      try {
        if (chatTarget.type === "traveler") {
          const params = new URLSearchParams({
            sender_session_key: sessionKeyRef.current,
          });
          const data = await apiFetch<ChatMessage[]>(
            `/live/travelers/${chatTarget.id}/chat?${params.toString()}`,
          );
          setMessages(data);
        } else {
          const data = await apiFetch<ChatMessage[]>(
            `/live/reports/${chatTarget.id}/chat`,
          );
          setMessages(data);
        }
      } catch {
        if (!silent) onToast?.("Could not load chat messages.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [chatTarget, onToast],
  );

  useEffect(() => {
    if (!chatOpen || !chatTarget) {
      setMessages([]);
      setInput("");
      return;
    }
    void loadMessages(false);
    const interval = window.setInterval(() => {
      void loadMessages(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [chatOpen, chatTarget, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !chatTarget) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, text, sender_label: "You", sent_at: new Date().toISOString() },
    ]);
    setInput("");
    setSending(true);

    try {
      if (chatTarget.type === "traveler") {
        const created = await apiFetch<{
          message_id: string;
          sent_at: string;
          text: string;
          sender_label: string;
        }>(`/live/travelers/${chatTarget.id}/chat`, {
          method: "POST",
          body: JSON.stringify({
            text,
            sender_session_key: sessionKeyRef.current,
          }),
        });
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== optimisticId)
            .concat({
              id: created.message_id,
              text: created.text,
              sender_label: "You",
              sent_at: created.sent_at,
            }),
        );
      } else {
        const created = await apiFetch<{
          message_id: string;
          sent_at: string;
          text: string;
          sender_label: string;
        }>(`/live/reports/${chatTarget.id}/chat`, {
          method: "POST",
          body: JSON.stringify({ text }),
        });
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== optimisticId)
            .concat({
              id: created.message_id,
              text: created.text,
              sender_label: "You",
              sent_at: created.sent_at,
            }),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      onToast?.("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 68,
        bottom: 0,
        width: 300,
        background: "white",
        zIndex: 23,
        transform: chatOpen ? "translateX(0)" : "translateX(calc(100% + 68px))",
        transition: "transform 0.25s ease",
        display: "flex",
        flexDirection: "column",
        pointerEvents: chatOpen ? "auto" : "none",
        borderLeft: "0.5px solid #e2e8f0",
      }}
    >
      {chatOpen && chatTarget ? (
        <>
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "0.5px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onBack}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              aria-label="Back"
            >
              <ArrowLeft size={18} color="#64748b" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#0f172a",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {chatTarget.label}
              </p>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>Anonymous</p>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Loader2 size={20} className="animate-spin" color="#0F766E" />
              </div>
            ) : null}

            {!loading && messages.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 24 }}>
                No messages yet
              </p>
            ) : null}

            {messages.map((message) => {
              const myMessage = message.sender_label === "You";
              return (
                <div
                  key={message.id}
                  style={{
                    maxWidth: "75%",
                    padding: "8px 12px",
                    borderRadius: myMessage ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: myMessage ? "#0F766E" : "#f1f5f9",
                    color: myMessage ? "#fff" : "#0f172a",
                    fontSize: 13,
                    lineHeight: 1.4,
                    alignSelf: myMessage ? "flex-end" : "flex-start",
                    marginBottom: 6,
                  }}
                >
                  {message.text}
                  <div
                    style={{
                      fontSize: 10,
                      color: myMessage ? "rgba(255,255,255,0.6)" : "#94a3b8",
                      marginTop: 3,
                      textAlign: "right",
                    }}
                  >
                    {timeAgo(message.sent_at)}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            {input.length >= 150 ? (
              <span
                style={{
                  position: "absolute",
                  top: -14,
                  right: 16,
                  fontSize: 10,
                  color: "#ef4444",
                }}
              >
                {input.length}/200
              </span>
            ) : null}
            <div
              style={{
                padding: "8px 12px",
                borderTop: "0.5px solid #e2e8f0",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSend();
                }}
                placeholder="Message..."
                maxLength={200}
                style={{
                  flex: 1,
                  borderRadius: 20,
                  padding: "8px 12px",
                  fontSize: 13,
                  border: "0.5px solid #e2e8f0",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !input.trim()}
                style={{
                  background: "#0F766E",
                  border: "none",
                  borderRadius: "50%",
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                  opacity: sending || !input.trim() ? 0.6 : 1,
                }}
                aria-label="Send message"
              >
                <Send size={15} color="#fff" />
              </button>
            </div>
            <p
              style={{
                fontSize: 10,
                color: "#94a3b8",
                textAlign: "center",
                margin: "4px 0 8px",
              }}
            >
              Anonymous · text only · expires with report
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
