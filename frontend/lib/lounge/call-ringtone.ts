export type CallRingtoneMode = "calling" | "ringing" | "incoming";

/** Web Audio ringtone: softer when callee offline, louder when ringing/incoming. */
export function startCallRingtoneLoop(mode: CallRingtoneMode): () => void {
  if (typeof window === "undefined") return () => {};
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return () => {};

  const ctx = new AC();
  let interval: ReturnType<typeof setInterval> | null = null;
  let alive = true;

  const params =
    mode === "calling"
      ? { gain: 0.055, periodMs: 3200 }
      : mode === "ringing"
        ? { gain: 0.14, periodMs: 1600 }
        : { gain: 0.16, periodMs: 2000 };

  const playBurst = () => {
    if (!alive) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const peak = params.gain;
    const beep = (offset: number, f1: number, f2: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const gn = ctx.createGain();
      o1.type = "sine";
      o2.type = "sine";
      o1.frequency.value = f1;
      o2.frequency.value = f2;
      o1.connect(gn);
      o2.connect(gn);
      gn.connect(ctx.destination);
      const st = t + offset;
      const dur = 0.19;
      gn.gain.setValueAtTime(0, st);
      gn.gain.linearRampToValueAtTime(peak, st + 0.02);
      gn.gain.linearRampToValueAtTime(0.0001, st + dur);
      o1.start(st);
      o1.stop(st + dur);
      o2.start(st);
      o2.stop(st + dur);
    };
    beep(0, 480, 440);
    beep(0.3, 520, 470);
  };

  playBurst();
  interval = globalThis.setInterval(playBurst, params.periodMs);

  return () => {
    alive = false;
    if (interval) globalThis.clearInterval(interval);
    void ctx.close();
  };
}
