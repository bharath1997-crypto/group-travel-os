"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  onChildAdded,
  get,
  type Database,
} from "firebase/database";
import { apiFetch } from "@/lib/api";
import { ICE_SERVERS, type GtCallHistoryEntry } from "@/lib/lounge/constants";
import { startCallRingtoneLoop } from "@/lib/lounge/call-ringtone";
import {
  requestCallNotificationPermission,
  showCallNotification,
} from "@/lib/lounge/call-notifications";
import { writeCallHistoryLs } from "@/lib/lounge/storage";

export type CallState = "idle" | "outgoing" | "incoming" | "active" | "ended";

export type CurrentCall = {
  callId: string;
  callType: "audio" | "video";
  remoteUser: { id: string; name: string; avatar: string | null };
  direction: "outgoing" | "incoming";
  startTime: number | null;
  duration: number;
};

type UseLoungeCallsOpts = {
  db: Database | null;
  userId: string | null;
  userName: string | null;
  onToast?: (msg: string) => void;
  onHistoryUpdate?: (entries: GtCallHistoryEntry[]) => void;
};

export function useLoungeCalls({
  db,
  userId,
  userName,
  onToast,
  onHistoryUpdate,
}: UseLoungeCallsOpts) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callListenersRef = useRef<(() => void)[]>([]);
  const processedIceRef = useRef<Set<string>>(new Set());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIncomingRef = useRef<{
    callId: string;
    callType: "audio" | "video";
    callerId: string;
    callerName: string;
    callerAvatar: string;
  } | null>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const lastIncomingNotifCallIdRef = useRef<string | null>(null);

  const stopRingtone = useCallback(() => {
    ringtoneStopRef.current?.();
    ringtoneStopRef.current = null;
  }, []);

  const showToast = useCallback(
    (msg: string) => onToast?.(msg),
    [onToast],
  );

  const clearCallDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const addCallListener = useCallback((unsub: () => void) => {
    callListenersRef.current.push(unsub);
  }, []);

  const endCallAndCleanup = useCallback(
    async (opts?: { history?: GtCallHistoryEntry; setEnded?: boolean }) => {
      stopRingtone();
      callListenersRef.current.forEach((u) => u());
      callListenersRef.current = [];
      clearCallDurationTimer();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      setIsMuted(false);
      setIsCameraOff(false);
      setIsSharingScreen(false);
      setAudioOutputDevices([]);
      if (opts?.history) {
        onHistoryUpdate?.([opts.history]);
        const existing = JSON.parse(
          localStorage.getItem("gt_call_history") || "[]",
        ) as GtCallHistoryEntry[];
        writeCallHistoryLs([opts.history, ...existing]);
      }
      if (opts?.setEnded) {
        setCallState("ended");
        globalThis.setTimeout(() => {
          setCallState("idle");
          setCurrentCall(null);
          setCallDurationSec(0);
        }, 2000);
      } else {
        setCallState("idle");
        setCurrentCall(null);
        setCallDurationSec(0);
      }
    },
    [clearCallDurationTimer, onHistoryUpdate, stopRingtone],
  );

  const startOutgoingCall = useCallback(
    async (
      callType: "audio" | "video",
      remote: { id: string; name: string; avatar: string | null },
    ) => {
      if (typeof RTCPeerConnection === "undefined") {
        showToast("Your browser doesn't support calls. Use Chrome or Edge.");
        return;
      }
      if (!db || !userId) {
        showToast("Cannot start call");
        return;
      }
      if (callStateRef.current !== "idle") return;

      try {
        await apiFetch(`/users/${encodeURIComponent(remote.id)}`);
      } catch {
        showToast("This user doesn't have an account.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });
      } catch {
        showToast("Please allow microphone/camera access");
        return;
      }

      const callId = push(ref(db, "calls")).key;
      if (!callId) {
        stream.getTracks().forEach((t) => t.stop());
        showToast("Could not start call");
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setCurrentCall({
        callId,
        callType,
        remoteUser: remote,
        direction: "outgoing",
        startTime: null,
        duration: 0,
      });
      setCallState("outgoing");
      stopRingtone();
      ringtoneStopRef.current = startCallRingtoneLoop("calling");

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      processedIceRef.current = new Set();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (event) => {
        setRemoteStream((prev) => {
          const s = prev ?? new MediaStream();
          if (!s.getTracks().some((t) => t.id === event.track.id)) s.addTrack(event.track);
          return s;
        });
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void push(ref(db, `calls/${callId}/ice_candidates/caller`), {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        });
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(ref(db, `calls/${callId}/offer`), { type: offer.type, sdp: offer.sdp });
        await update(ref(db, `calls/${callId}`), {
          caller_id: userId,
          callee_id: remote.id,
          call_type: callType,
          status: "ringing",
          created_at: Date.now(),
        });
        await set(ref(db, `users/${remote.id}/incoming_call`), {
          call_id: callId,
          caller_name: userName ?? "Someone",
          caller_avatar: "",
          call_type: callType,
        });

        const uIce = onChildAdded(ref(db, `calls/${callId}/ice_candidates/callee`), async (c) => {
          const v = c.val() as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null;
          if (!v?.candidate || !pc) return;
          const k = c.key;
          if (!k || processedIceRef.current.has(k)) return;
          processedIceRef.current.add(k);
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate({
                candidate: v.candidate,
                sdpMid: v.sdpMid ?? null,
                sdpMLineIndex: v.sdpMLineIndex ?? 0,
              }),
            );
          } catch { /* ignore */ }
        });
        addCallListener(uIce);

        const uAnswer = onValue(ref(db, `calls/${callId}/answer`), async (snap) => {
          const ans = snap.val() as { type?: string; sdp?: string } | null;
          if (!ans?.sdp || pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(new RTCSessionDescription({ type: (ans.type ?? "answer") as RTCSdpType, sdp: ans.sdp }));
          stopRingtone();
          setCallState("active");
          setCurrentCall((prev) => (prev ? { ...prev, startTime: Date.now() } : prev));
          clearCallDurationTimer();
          durationTimerRef.current = setInterval(() => setCallDurationSec((s) => s + 1), 1000);
        });
        addCallListener(uAnswer);

        const uEnd = onValue(ref(db, `calls/${callId}/status`), (s) => {
          if (s.val() === "ended" && callStateRef.current !== "idle") {
            void endCallAndCleanup({
              history: {
                user_id: remote.id,
                user_name: remote.name,
                call_type: callType,
                direction: "outgoing",
                duration: callDurationSec,
                timestamp: Date.now(),
                status: "ended",
              },
              setEnded: true,
            });
          }
        });
        addCallListener(uEnd);
      } catch {
        showToast("Could not start call");
        stream.getTracks().forEach((t) => t.stop());
        void endCallAndCleanup();
      }
    },
    [db, userId, userName, showToast, addCallListener, clearCallDurationTimer, endCallAndCleanup, callDurationSec],
  );

  const acceptIncomingCall = useCallback(async () => {
    const p = pendingIncomingRef.current;
    if (!p || !db || !userId || callStateRef.current !== "incoming") return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: p.callType === "video",
      });
    } catch {
      showToast("Please allow microphone/camera access");
      return;
    }

    const callId = p.callId;
    localStreamRef.current = stream;
    setLocalStream(stream);
    setCurrentCall({
      callId,
      callType: p.callType,
      remoteUser: { id: p.callerId, name: p.callerName, avatar: p.callerAvatar || null },
      direction: "incoming",
      startTime: Date.now(),
      duration: 0,
    });

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    processedIceRef.current = new Set();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (event) => {
      setRemoteStream((prev) => {
        const s = prev ?? new MediaStream();
        if (!s.getTracks().some((t) => t.id === event.track.id)) s.addTrack(event.track);
        return s;
      });
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      void push(ref(db, `calls/${callId}/ice_candidates/callee`), {
        candidate: ev.candidate.candidate,
        sdpMid: ev.candidate.sdpMid,
        sdpMLineIndex: ev.candidate.sdpMLineIndex,
      });
    };

    try {
      const os = await get(ref(db, `calls/${callId}/offer`));
      const o = os.val() as { type?: string; sdp?: string } | null;
      if (!o?.sdp) throw new Error("no offer");
      await pc.setRemoteDescription(new RTCSessionDescription({ type: (o.type ?? "offer") as RTCSdpType, sdp: o.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await set(ref(db, `calls/${callId}/answer`), { type: answer.type, sdp: answer.sdp });
      await update(ref(db, `calls/${callId}`), { status: "active" });
      await remove(ref(db, `users/${userId}/incoming_call`)).catch(() => {});
      stopRingtone();
      setCallState("active");
      clearCallDurationTimer();
      durationTimerRef.current = setInterval(() => setCallDurationSec((s) => s + 1), 1000);

      const uIce = onChildAdded(ref(db, `calls/${callId}/ice_candidates/caller`), async (c) => {
        const v = c.val() as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null;
        if (!v?.candidate) return;
        const k = c.key;
        if (!k || processedIceRef.current.has(k)) return;
        processedIceRef.current.add(k);
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate({
              candidate: v.candidate,
              sdpMid: v.sdpMid ?? null,
              sdpMLineIndex: v.sdpMLineIndex ?? 0,
            }),
          );
        } catch { /* ignore */ }
      });
      addCallListener(uIce);
    } catch {
      showToast("Could not connect call");
      stream.getTracks().forEach((t) => t.stop());
      void endCallAndCleanup();
    }
  }, [db, userId, showToast, addCallListener, clearCallDurationTimer, endCallAndCleanup, stopRingtone]);

  const declineIncomingCall = useCallback(async () => {
    const p = pendingIncomingRef.current;
    if (!p || !db) return;
    stopRingtone();
    try {
      await update(ref(db, `calls/${p.callId}`), { status: "ended" });
    } catch { /* ignore */ }
    if (userId) await remove(ref(db, `users/${userId}/incoming_call`)).catch(() => {});
    pendingIncomingRef.current = null;
    setCallState("idle");
    setCurrentCall(null);
  }, [db, userId]);

  const hangupCall = useCallback(() => {
    const cc = currentCall;
    if (!cc || !db) return;
    const dur = cc.startTime ? Math.max(0, Math.floor((Date.now() - cc.startTime) / 1000)) : 0;
    void update(ref(db, `calls/${cc.callId}`), { status: "ended" }).catch(() => {});
    void endCallAndCleanup({
      history: {
        user_id: cc.remoteUser.id,
        user_name: cc.remoteUser.name,
        call_type: cc.callType,
        direction: cc.direction,
        duration: dur,
        timestamp: Date.now(),
        status: "ended",
      },
      setEnded: true,
    });
  }, [currentCall, db, endCallAndCleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setIsCameraOff((c) => {
      const next = !c;
      localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

  const shareScreen = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || callStateRef.current !== "active") {
      showToast("Start a call first");
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const vTrack = display.getVideoTracks()[0];
      if (!vTrack) {
        showToast("No screen track");
        return;
      }
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(vTrack);
      } else {
        pc.addTrack(vTrack, display);
      }
      vTrack.addEventListener("ended", () => {
        const loc = localStreamRef.current?.getVideoTracks()[0];
        if (loc && videoSender) void videoSender.replaceTrack(loc);
        setIsSharingScreen(false);
      });
      setIsSharingScreen(true);
      showToast("Sharing your screen");
    } catch {
      showToast("Screen share cancelled");
    }
  }, [showToast]);

  const listAudioOutputs = useCallback(async () => {
    try {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audiooutput",
      );
      if (!list.length) {
        showToast("Change speaker in system or browser settings");
        return;
      }
      setAudioOutputDevices(list);
    } catch {
      showToast("Could not list audio outputs");
    }
  }, [showToast]);

  const setAudioOutput = useCallback(async (deviceId: string) => {
    const el = remoteAudioRef.current;
    if (!el || typeof (el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId !== "function") {
      showToast("Audio output switching not supported in this browser");
      setAudioOutputDevices([]);
      return;
    }
    try {
      await (el as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
      showToast("Audio output updated");
      setAudioOutputDevices([]);
    } catch {
      showToast("Could not switch audio output");
    }
  }, [showToast]);

  const bindRemoteAudioElement = useCallback((el: HTMLVideoElement | null) => {
    remoteAudioRef.current = el;
  }, []);

  useEffect(() => {
    void requestCallNotificationPermission();
  }, []);

  useEffect(() => {
    if (!db || !userId) return;
    const unsub = onValue(ref(db, `users/${userId}/incoming_call`), (snap) => {
      if (!snap.exists()) {
        if (callStateRef.current === "incoming") {
          stopRingtone();
          setCallState("idle");
          setCurrentCall(null);
        }
        pendingIncomingRef.current = null;
        lastIncomingNotifCallIdRef.current = null;
        return;
      }
      const v = snap.val() as {
        call_id?: string;
        caller_name?: string;
        caller_avatar?: string;
        call_type?: "audio" | "video";
      } | null;
      if (!v?.call_id || callStateRef.current !== "idle") return;
      const callType: "audio" | "video" = v.call_type === "video" ? "video" : "audio";
      if (lastIncomingNotifCallIdRef.current !== v.call_id) {
        lastIncomingNotifCallIdRef.current = v.call_id;
        showCallNotification(v.caller_name ?? "Someone", callType);
      }
      void get(ref(db, `calls/${v.call_id}`)).then((cs) => {
        const callData = cs.val() as { caller_id?: string } | null;
        const callerId = callData?.caller_id ?? "unknown";
        pendingIncomingRef.current = {
          callId: v.call_id!,
          callType,
          callerId,
          callerName: v.caller_name ?? "Someone",
          callerAvatar: v.caller_avatar ?? "",
        };
        setCurrentCall({
          callId: v.call_id!,
          callType,
          remoteUser: {
            id: callerId,
            name: v.caller_name ?? "Someone",
            avatar: v.caller_avatar ?? null,
          },
          direction: "incoming",
          startTime: null,
          duration: 0,
        });
        stopRingtone();
        ringtoneStopRef.current = startCallRingtoneLoop("incoming");
        setCallState("incoming");
      });
    });
    return () => unsub();
  }, [db, userId, stopRingtone]);

  useEffect(() => {
    if (callState === "outgoing") {
      const t = globalThis.setTimeout(() => {
        if (callStateRef.current === "outgoing") {
          stopRingtone();
          ringtoneStopRef.current = startCallRingtoneLoop("ringing");
        }
      }, 4000);
      return () => globalThis.clearTimeout(t);
    }
    return undefined;
  }, [callState, stopRingtone]);

  return {
    callState,
    currentCall,
    callDurationSec,
    isMuted,
    isCameraOff,
    localStream,
    remoteStream,
    startOutgoingCall,
    acceptIncomingCall,
    declineIncomingCall,
    hangupCall,
    toggleMute,
    toggleCamera,
    shareScreen,
    isSharingScreen,
    audioOutputDevices,
    listAudioOutputs,
    setAudioOutput,
    bindRemoteAudioElement,
  };
}
