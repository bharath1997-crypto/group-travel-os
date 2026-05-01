"use client";

import { useState } from "react";

type AgentFABProps = {
  onToggle?: (open: boolean) => void;
  className?: string;
};

export function AgentFAB({ onToggle, className = "" }: AgentFABProps) {
  const [open, setOpen] = useState(false);

  function handleClick() {
    setOpen((current) => {
      const next = !current;
      onToggle?.(next);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("travello-agent-toggle"));

        const existingAgentButton = document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open Travello assistant"], button[aria-label="Close Travello assistant"]',
        );

        if (existingAgentButton) {
          existingAgentButton.click();
        } else {
          console.log("agent toggled");
        }
      }

      return next;
    });
  }

  return (
    <>
      <div
        className={`agent-fab ${className}`.trim()}
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}
      >
        <div className="agent-fab__ring" aria-hidden />
        <div className="agent-fab__dot-orbit" aria-hidden>
          <span className="agent-fab__dot" />
        </div>
        <div className="agent-fab__separator" aria-hidden />
        <button
          type="button"
          className="agent-fab__button"
          onClick={handleClick}
          aria-label={open ? "Close Travello agent" : "Open Travello agent"}
          aria-pressed={open}
        >
          <svg width="26" height="24" viewBox="0 0 28 26" fill="none">
            <path
              d="M24 0H4C1.8 0 0 1.8 0 4v14c0 2.2 1.8 4 4 4h6l4 4 4-4h6c2.2 0 4-1.8 4-4V4c0-2.2-1.8-4-4-4z"
              fill="#FFFFFF"
              opacity="0.95"
            />
            <circle cx="8" cy="11" r="2" fill="#1C2B3A"/>
            <circle cx="14" cy="11" r="2" fill="#1C2B3A"/>
            <circle cx="20" cy="11" r="2" fill="#1C2B3A"/>
          </svg>
        </button>
      </div>

      <style>{`
        .agent-fab {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .agent-fab__ring {
          position: absolute;
          inset: 0;
          width: 72px;
          height: 72px;
          border-radius: 9999px;
          border: 2px solid transparent;
          border-top-color: #E8619A;
          border-right-color: #E8619A;
          animation: agent-fab-rotate 2.4s linear infinite;
        }

        .agent-fab__dot-orbit {
          position: absolute;
          inset: 0;
          width: 72px;
          height: 72px;
          animation: agent-fab-rotate 2.4s linear infinite;
        }

        .agent-fab__dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #E8619A;
          border: 2px solid #FFFFFF;
          transform: translate(-50%, -50%) translateX(36px);
          box-sizing: border-box;
        }

        .agent-fab__separator {
          position: absolute;
          width: 66px;
          height: 66px;
          border-radius: 9999px;
          border: 2.5px solid rgba(255, 255, 255, 0.85);
          box-sizing: border-box;
        }

        .agent-fab__button {
          position: relative;
          width: 58px;
          height: 58px;
          border: 0;
          border-radius: 9999px;
          background: #1C2B3A;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.18s ease;
          padding: 0;
        }

        .agent-fab__button:hover {
          transform: scale(1.07);
        }

        .agent-fab__button:focus-visible {
          outline: 2px solid #E8619A;
          outline-offset: 3px;
        }

        @keyframes agent-fab-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

export default AgentFAB;
