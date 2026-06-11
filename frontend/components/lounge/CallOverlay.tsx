"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Monitor, Volume2 } from "lucide-react";
import type { CallState, CurrentCall } from "./useLoungeCalls";
import { formatCallDurationFmt } from "@/lib/lounge/storage";

type CallOverlayProps = {
  callState: CallState;
  currentCall: CurrentCall | null;
  callDurationSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSharingScreen?: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioOutputDevices?: MediaDeviceInfo[];
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onShareScreen?: () => void;
  onListAudioOutputs?: () => void;
  onSetAudioOutput?: (deviceId: string) => void;
  onBindRemoteAudio?: (el: HTMLVideoElement | null) => void;
};

export function CallOverlay({
  callState,
  currentCall,
  callDurationSec,
  isMuted,
  isCameraOff,
  isSharingScreen,
  localStream,
  remoteStream,
  audioOutputDevices = [],
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onShareScreen,
  onListAudioOutputs,
  onSetAudioOutput,
  onBindRemoteAudio,
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => {});
      onBindRemoteAudio?.(remoteVideoRef.current);
    }
  }, [remoteStream, onBindRemoteAudio]);

  if (callState === "idle" || !currentCall) return null;

  const isVideo = currentCall.callType === "video" || isSharingScreen;
  const name = currentCall.remoteUser.name;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-slate-900 text-white">
      {isVideo && callState === "active" ? (
        <div className="relative flex-1 bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-24 w-20 rounded-lg border border-white/30 object-cover"
          />
          {isSharingScreen ? (
            <span className="absolute top-4 left-4 rounded-full bg-red-600/90 px-3 py-1 text-[10px] font-bold uppercase">
              Sharing screen
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          {/* Hidden element for audio output routing on voice calls */}
          <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F766E] text-2xl font-bold">
            {name.charAt(0)}
          </div>
          <p className="text-lg font-bold">{name}</p>
          <p className="text-sm text-white/60">
            {callState === "outgoing"
              ? "Calling..."
              : callState === "incoming"
                ? `Incoming ${currentCall.callType === "video" ? "video" : "voice"} call`
                : callState === "ended"
                  ? "Call ended"
                  : formatCallDurationFmt(callDurationSec)}
          </p>
        </div>
      )}

      {audioOutputDevices.length > 0 ? (
        <div className="max-h-32 overflow-y-auto border-t border-white/10 bg-slate-800 px-4 py-2">
          <p className="mb-1 text-[10px] font-bold uppercase text-white/50">Audio output</p>
          {audioOutputDevices.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => onSetAudioOutput?.(d.deviceId)}
              className="block w-full truncate py-1.5 text-left text-xs text-white hover:text-teal-300"
            >
              {d.label || "Speaker"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3 px-6 py-8">
        {callState === "incoming" ? (
          <>
            <button type="button" onClick={onDecline} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600">
              <PhoneOff size={22} />
            </button>
            <button type="button" onClick={onAccept} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600">
              <Phone size={22} />
            </button>
          </>
        ) : callState === "active" ? (
          <>
            <button type="button" onClick={onToggleMute} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {(isVideo || currentCall.callType === "video") ? (
              <button type="button" onClick={onToggleCamera} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
                {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
            ) : null}
            <button type="button" onClick={onShareScreen} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" title="Share screen">
              <Monitor size={18} />
            </button>
            <button type="button" onClick={onListAudioOutputs} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" title="Speaker / Bluetooth">
              <Volume2 size={18} />
            </button>
            <button type="button" onClick={onHangup} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600">
              <PhoneOff size={22} />
            </button>
          </>
        ) : (
          <button type="button" onClick={onHangup} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600">
            <PhoneOff size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
