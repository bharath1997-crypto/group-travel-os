"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

type GroupOut = {
  id: string;
  name: string;
};

function JoinPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = (params.get("code") || params.get("invite") || "").trim();

  const [phase, setPhase] = useState<"idle" | "joining" | "ok" | "err">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Missing invite code");
      setPhase("err");
      return;
    }
    const token = getToken();
    if (!token) {
      const next = `/join?code=${encodeURIComponent(code)}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setPhase("joining");
    void (async () => {
      try {
        const g = await apiFetch<GroupOut>("/groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_code: code }),
        });
        setGroupName(g.name);
        setPhase("ok");
        setTimeout(() => router.replace("/travel-hub"), 800);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not join group";
        if (msg.toLowerCase().includes("already")) {
          setGroupName("");
          setPhase("ok");
          setTimeout(() => router.replace("/travel-hub"), 600);
          return;
        }
        setError(msg);
        setPhase("err");
      }
    })();
  }, [code, router]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#0b1220] px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Group invite
        </p>
        {phase === "idle" || phase === "joining" ? (
          <>
            <h1 className="mt-2 text-lg font-bold">Joining group…</h1>
            <p className="mt-1 text-sm text-white/70">
              Code:{" "}
              <span className="font-mono text-white">{code || "—"}</span>
            </p>
            <div className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </>
        ) : null}
        {phase === "ok" ? (
          <>
            <h1 className="mt-2 text-lg font-bold">
              {groupName
                ? `Joined ${groupName}`
                : "You're already in this group"}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Taking you to Travel Hub…
            </p>
          </>
        ) : null}
        {phase === "err" ? (
          <>
            <h1 className="mt-2 text-lg font-bold text-rose-300">
              Could not join
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {error || "The invite link is invalid or expired."}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
              onClick={() => router.replace("/travel-hub")}
            >
              Back to Travel Hub
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-[#0b1220] text-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      }
    >
      <JoinPageInner />
    </Suspense>
  );
}
