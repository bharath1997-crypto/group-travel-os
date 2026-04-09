"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";

export default function JoinByInvitePage() {
  const params = useParams();
  const inviteCode =
    typeof params.invite_code === "string"
      ? params.invite_code
      : Array.isArray(params.invite_code)
        ? params.invite_code[0]
        : "";

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasSession(isLoggedIn() && getToken() !== null);
  }, []);

  const loginHref = `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`;

  const handleRequestJoin = useCallback(async () => {
    if (!inviteCode) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/groups/join", {
        method: "POST",
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [inviteCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Join a group</h1>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve been invited with code:
        </p>
        <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2 font-mono text-sm text-slate-900">
          {inviteCode || "—"}
        </p>

        {hasSession === null ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : success ? (
          <p className="mt-6 text-sm text-slate-700">
            Request submitted! The admin will review your request.
          </p>
        ) : !hasSession ? (
          <>
            <p className="mt-6 text-sm text-slate-600">
              Please log in to join.
            </p>
            <Link
              href={loginHref}
              className="mt-4 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Log in to join
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleRequestJoin()}
              disabled={submitting || !inviteCode}
              className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Request to join this group"}
            </button>
            {error ? (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
