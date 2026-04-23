"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/**
 * E.164 from country dial and national part. Strips all non-digits from both.
 * If the national part already includes the same country code (e.g. pasted +1 full number), does not repeat it.
 */
function buildE164(dialCode: string, nationalNumber: string): string {
  const nationalDigits = nationalNumber.replace(/\D/g, "");
  if (!nationalDigits) return "";
  const dialDigits = dialCode.replace(/\D/g, "");
  if (!dialDigits) return "";
  if (nationalDigits.startsWith(dialDigits)) {
    return `+${nationalDigits}`;
  }
  return `+${dialDigits}${nationalDigits}`;
}

function normalizeInstagramHandle(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("@") ? t : `@${t}`;
}

const COUNTRY_DIAL_OPTIONS: { label: string; value: string }[] = [
  { label: "United States / Canada (+1)", value: "+1" },
  { label: "United Kingdom (+44)", value: "+44" },
  { label: "India (+91)", value: "+91" },
  { label: "Australia (+61)", value: "+61" },
  { label: "Germany (+49)", value: "+49" },
  { label: "France (+33)", value: "+33" },
  { label: "Brazil (+55)", value: "+55" },
  { label: "Mexico (+52)", value: "+52" },
  { label: "Japan (+81)", value: "+81" },
  { label: "China (+86)", value: "+86" },
  { label: "South Korea (+82)", value: "+82" },
  { label: "Spain (+34)", value: "+34" },
  { label: "Italy (+39)", value: "+39" },
  { label: "Netherlands (+31)", value: "+31" },
];

const NAVY = "#0F3460";
const CORAL = "#E94560";
const TEAL = "#0D9488";
const PINK_RING = "#EC4899";
const CRIMSON = "#DC2626";
const BORDER = "#E9ECEF";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DICEBEAR_INITIALS = "https://api.dicebear.com/7.x/initials/svg";

const CURRENCY_OPTIONS: {
  code: string;
  flag: string;
  symbol: string;
}[] = [
  { code: "USD", flag: "🇺🇸", symbol: "$" },
  { code: "EUR", flag: "🇪🇺", symbol: "€" },
  { code: "GBP", flag: "🇬🇧", symbol: "£" },
  { code: "INR", flag: "🇮🇳", symbol: "₹" },
  { code: "JPY", flag: "🇯🇵", symbol: "¥" },
  { code: "AUD", flag: "🇦🇺", symbol: "A$" },
  { code: "CAD", flag: "🇨🇦", symbol: "C$" },
  { code: "SGD", flag: "🇸🇬", symbol: "S$" },
  { code: "AED", flag: "🇦🇪", symbol: "د.إ" },
  { code: "THB", flag: "🇹🇭", symbol: "฿" },
];

const TRAVEL_EMOJIS = ["✈️", "🌍", "🏔️", "🏖️", "🎒", "🗺️", "🧳", "🚂"] as const;

type Me = {
  id?: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  profile_picture?: string | null;
  currency?: string | null;
  email_verified?: boolean;
  is_verified?: boolean;
  phone?: string | null;
  country?: string | null;
  recovery_email?: string | null;
  username?: string | null;
  instagram_handle?: string | null;
  whatsapp_verified?: boolean;
  profile_completion_filled?: number;
  profile_completion_total?: number;
};

function isHttpDataAvatar(s: string): boolean {
  const t = s.trim();
  return t.startsWith("data:") || t.startsWith("http://") || t.startsWith("https://");
}

function isIndiaCountryName(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const t = s.trim().toLowerCase();
  return t === "in" || t === "ind" || t.includes("india");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

type PhotoAccordion = "upload" | "emoji" | "auto" | "google" | null;

function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return ok ? (
    <span className="text-sm font-semibold text-emerald-700">{okLabel}</span>
  ) : (
    <span className="text-sm font-semibold text-rose-600">{badLabel}</span>
  );
}

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const geoStartedRef = useRef(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoAccordion, setPhotoAccordion] = useState<PhotoAccordion>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [modalEmojiPick, setModalEmojiPick] = useState<string | null>(null);
  /** New avatar choice applied on "Save and continue" (data URL, emoji, DiceBear, or Google photo URL). */
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);

  const [phoneDial, setPhoneDial] = useState("+1");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerifiedLocal, setPhoneVerifiedLocal] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  const [emailVerifyBusy, setEmailVerifyBusy] = useState(false);
  const [emailVerifyErr, setEmailVerifyErr] = useState<string | null>(null);
  const [emailVerifyOk, setEmailVerifyOk] = useState(false);

  const [waDial, setWaDial] = useState("+1");
  const [waLocal, setWaLocal] = useState("");
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtp, setWaOtp] = useState("");
  const [waVerifiedLocal, setWaVerifiedLocal] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waErr, setWaErr] = useState<string | null>(null);

  const [instagram, setInstagram] = useState("");
  const [instagramSaveBusy, setInstagramSaveBusy] = useState(false);
  const [instagramErr, setInstagramErr] = useState<string | null>(null);

  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const phoneE164 = useMemo(
    () => buildE164(phoneDial, phoneLocal),
    [phoneDial, phoneLocal],
  );
  const waPhone = useMemo(
    () => buildE164(waDial, waLocal),
    [waDial, waLocal],
  );

  const refetchMe = useCallback(async () => {
    const u = await apiFetch<Me>("/auth/me");
    setMe(u);
    return u;
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    let c = false;
    (async () => {
      try {
        const u = await apiFetch<Me>("/auth/me");
        if (c) return;
        setMe(u);
        setFullName(u.full_name?.trim() ?? "");
        setUsername((u.username ?? "").trim());
        setCountry((u.country ?? "").trim());
        setRecoveryEmail((u.recovery_email ?? "").trim());
        setInstagram((u.instagram_handle ?? "").trim());
        const cur = (u.currency ?? "").trim().toUpperCase();
        if (cur.length === 3 && CURRENCY_OPTIONS.some((c) => c.code === cur)) {
          setCurrency(cur);
          setCurrencyTouched(true);
        } else {
          setCurrency(isIndiaCountryName(u.country ?? "") ? "INR" : "USD");
          setCurrencyTouched(false);
        }
      } catch {
        if (!c) router.replace("/login");
      }
    })();
    return () => {
      c = true;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("gt_onboarding_gdrive") === "1") {
        setGoogleDriveConnected(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Reverse geocode to fill country when the account has no country yet.
  useEffect(() => {
    if (!me) return;
    if (String(me.country ?? "").trim()) return;
    if (geoStartedRef.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;
    geoStartedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        void (async () => {
          try {
            const r = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=en`,
            );
            if (!r.ok) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = await r.json();
            const name = typeof data?.countryName === "string" ? data.countryName : "";
            if (!name) return;
            setCountry((prev) => (prev.trim() ? prev : name));
          } catch {
            /* leave empty on failure */
          }
        })();
      },
      () => {
        /* denied or unavailable: leave field empty */
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 },
    );
  }, [me]);

  // Default currency from country until the user changes the currency control.
  useEffect(() => {
    if (currencyTouched) return;
    setCurrency(isIndiaCountryName(country) ? "INR" : "USD");
  }, [country, currencyTouched]);

  const autoDicebearUrl = useMemo(() => {
    const seed =
      username.trim() ||
      fullName.trim() ||
      me?.username?.trim() ||
      me?.full_name?.trim() ||
      me?.id ||
      "traveler";
    return `${DICEBEAR_INITIALS}?seed=${encodeURIComponent(seed)}`;
  }, [username, fullName, me?.username, me?.full_name, me?.id]);

  const openPhotoPicker = useCallback(() => {
    setUploadPreview(null);
    setModalEmojiPick(TRAVEL_EMOJIS[0] ?? "✈️");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPhotoPickerOpen(true);
  }, []);

  const onProfilePhotoFile = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      if (file.size > MAX_IMAGE_BYTES) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setUploadPreview(dataUrl);
        setPendingAvatarUrl(dataUrl);
        setModalEmojiPick(null);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const onPickEmoji = useCallback((e: string) => {
    setModalEmojiPick(e);
    setPendingAvatarUrl(e);
    setUploadPreview(null);
  }, []);

  const onPickDicebear = useCallback(() => {
    setPendingAvatarUrl(autoDicebearUrl);
    setUploadPreview(null);
    setModalEmojiPick(null);
  }, [autoDicebearUrl]);

  const onPickGooglePhoto = useCallback(() => {
    const u = me?.profile_picture?.trim();
    if (!u) return;
    setPendingAvatarUrl(u);
    setUploadPreview(null);
    setModalEmojiPick(null);
  }, [me?.profile_picture]);

  const topProfilePreview = useMemo(() => {
    if (pendingAvatarUrl) return pendingAvatarUrl;
    const a = me?.avatar_url?.trim();
    if (a) return a;
    const p = me?.profile_picture?.trim();
    if (p) return p;
    return null;
  }, [pendingAvatarUrl, me?.avatar_url, me?.profile_picture]);

  const emailOk = Boolean(me?.email_verified ?? me?.is_verified);
  const phoneOk = Boolean(
    (me?.phone && String(me.phone).trim()) || phoneVerifiedLocal,
  );
  const googleOk = (me?.avatar_url ?? "").includes("googleusercontent.com");
  const waOk = Boolean(me?.whatsapp_verified) || waVerifiedLocal;
  const igOk = Boolean((me?.instagram_handle ?? "").trim());
  const gdriveOk = googleDriveConnected;

  const verifiedCount = useMemo(
    () =>
      [emailOk, phoneOk, googleOk, waOk, igOk, gdriveOk].filter(Boolean)
        .length,
    [emailOk, phoneOk, googleOk, waOk, igOk, gdriveOk],
  );

  const onEmailVerify = useCallback(async () => {
    if (!me?.email) return;
    setEmailVerifyErr(null);
    setEmailVerifyOk(false);
    setEmailVerifyBusy(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: me.email }),
      });
      setEmailVerifyOk(true);
    } catch (e) {
      setEmailVerifyErr(extractErrorMessage(e));
    } finally {
      setEmailVerifyBusy(false);
    }
  }, [me?.email]);

  const onPhoneSendOtp = useCallback(async () => {
    if (!phoneE164 || phoneE164.length < 10) {
      setPhoneErr("Enter a valid phone number.");
      return;
    }
    setPhoneErr(null);
    setPhoneBusy(true);
    try {
      console.log("[onboarding] E164 phone (SMS send)", phoneE164);
      await apiFetch("/auth/phone/send", {
        method: "POST",
        body: JSON.stringify({ phone: phoneE164 }),
      });
      setPhoneOtpSent(true);
    } catch (e) {
      setPhoneErr(extractErrorMessage(e));
    } finally {
      setPhoneBusy(false);
    }
  }, [phoneE164]);

  const onPhoneVerifyOtp = useCallback(async () => {
    if (!phoneE164) return;
    setPhoneErr(null);
    setPhoneBusy(true);
    try {
      console.log("[onboarding] E164 phone (SMS verify)", phoneE164);
      await apiFetch("/auth/phone/verify", {
        method: "POST",
        body: JSON.stringify({ phone: phoneE164, otp: phoneOtp.trim() }),
      });
      setPhoneVerifiedLocal(true);
      await refetchMe();
    } catch (e) {
      setPhoneErr(extractErrorMessage(e));
    } finally {
      setPhoneBusy(false);
    }
  }, [phoneE164, phoneOtp, refetchMe]);

  const onWhatsAppSendOtp = useCallback(async () => {
    if (!waPhone || waPhone.length < 10) {
      setWaErr("Enter a valid phone number.");
      return;
    }
    setWaErr(null);
    setWaBusy(true);
    try {
      console.log("[onboarding] E164 phone (WhatsApp send)", waPhone);
      await apiFetch("/auth/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({ phone: waPhone }),
      });
      setWaOtpSent(true);
    } catch (e) {
      setWaErr(extractErrorMessage(e));
    } finally {
      setWaBusy(false);
    }
  }, [waPhone]);

  const onWhatsAppVerifyOtp = useCallback(async () => {
    if (!waPhone) return;
    setWaErr(null);
    setWaBusy(true);
    try {
      console.log("[onboarding] E164 phone (WhatsApp verify)", waPhone);
      await apiFetch("/auth/whatsapp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: waPhone, otp: waOtp.trim() }),
      });
      setWaVerifiedLocal(true);
      await refetchMe();
    } catch (e) {
      setWaErr(extractErrorMessage(e));
    } finally {
      setWaBusy(false);
    }
  }, [waPhone, waOtp, refetchMe]);

  const onSaveInstagram = useCallback(async () => {
    const h = normalizeInstagramHandle(instagram);
    if (!h) {
      setInstagramErr("Enter your Instagram handle.");
      return;
    }
    setInstagramErr(null);
    setInstagramSaveBusy(true);
    try {
      await apiFetch<Me>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ instagram_handle: h }),
      });
      setInstagram(h);
      await refetchMe();
    } catch (e) {
      setInstagramErr(extractErrorMessage(e));
    } finally {
      setInstagramSaveBusy(false);
    }
  }, [instagram, refetchMe]);

  const onVerifyInstagram = useCallback(() => {
    const h = normalizeInstagramHandle(instagram);
    if (!h) return;
    const u = h.replace(/^@/, "");
    window.open(
      `https://www.instagram.com/${encodeURIComponent(u)}/`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [instagram]);

  const onConnectGoogleDrive = useCallback(() => {
    try {
      sessionStorage.setItem("gt_onboarding_gdrive", "1");
    } catch {
      /* ignore */
    }
    window.location.href = `${API_BASE}/auth/oauth/google/start?scope=drive`;
  }, []);

  const onSaveAndContinue = useCallback(async () => {
    if (!me) return;
    setSaveErr(null);
    setSaveBusy(true);
    try {
      const ih = normalizeInstagramHandle(instagram);
      const body: Record<string, unknown> = {
        full_name: (fullName.trim() || me.full_name) as string,
        username: username.trim() ? username.trim() : null,
        country: country.trim() || null,
        recovery_email: recoveryEmail.trim()
          ? recoveryEmail.trim().toLowerCase()
          : null,
        currency: currency || "USD",
      };
      if (ih) body.instagram_handle = ih;
      if (pendingAvatarUrl) {
        body.avatar_url = pendingAvatarUrl;
      }
      await apiFetch<Me>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      router.push("/profile");
    } catch (e) {
      setSaveErr(extractErrorMessage(e));
    } finally {
      setSaveBusy(false);
    }
  }, [
    me,
    fullName,
    username,
    country,
    recoveryEmail,
    instagram,
    currency,
    pendingAvatarUrl,
    router,
  ]);

  const showPhoneFlow = !phoneOk;
  const showWaFlow = !waOk;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F8F9FA]" style={{ color: NAVY }}>
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#0F3460]"
          >
            <span aria-hidden>←</span> Back to profile
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-xl">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <span>Profile progress</span>
              <span>
                {verifiedCount}/6 verified
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(verifiedCount / 6) * 100}%`,
                  backgroundColor: CORAL,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-8">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-slate-900">Your profile</h2>
            <p className="mt-1 text-sm text-slate-600">
              Name, location, and contact details. Saved when you continue below.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                  placeholder="@handle"
                  autoComplete="username"
                />
              </label>
              <div className="block sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Country / region</span>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                    placeholder="e.g. India"
                    autoComplete="country-name"
                  />
                </label>
                <label className="mt-3 block sm:mt-0">
                  <span className="text-xs font-semibold text-slate-700">Currency</span>
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      setCurrencyTouched(true);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                    aria-label="Currency"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} {c.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700">Recovery email</span>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                  placeholder="backup@email.com"
                  autoComplete="email"
                />
              </label>
              <div className="block sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700">Profile photo</span>
                <div className="mt-2">
                  {topProfilePreview ? (
                    <div className="mb-2 flex items-center gap-3">
                      {isHttpDataAvatar(topProfilePreview) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={topProfilePreview}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-full border-2 object-cover"
                          style={{ borderColor: PINK_RING }}
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 bg-slate-50 text-3xl leading-none"
                          style={{ borderColor: PINK_RING }}
                        >
                          {topProfilePreview}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    className="hidden"
                    onChange={(e) => {
                      void onProfilePhotoFile(e.target.files);
                    }}
                  />
                  <button
                    type="button"
                    onClick={openPhotoPicker}
                    className="text-sm font-semibold text-[#0D9488] underline-offset-2 hover:underline"
                  >
                    Change photo
                  </button>
                  {photoPickerOpen ? (
                    <div
                      className="mt-3 overflow-hidden rounded-2xl border bg-white p-1 shadow-sm"
                      style={{ borderColor: BORDER }}
                    >
                      {(
                        [
                          {
                            id: "upload" as const,
                            icon: "📷",
                            title: "Upload from device",
                            desc: "JPG, PNG, WEBP — max 5MB",
                          },
                          {
                            id: "emoji" as const,
                            icon: "🎭",
                            title: "Choose travel avatar",
                            desc: "Pick a travel emoji",
                          },
                          {
                            id: "auto" as const,
                            icon: "✨",
                            title: "Auto avatar from name",
                            desc: "DiceBear initials style",
                          },
                          ...(me?.profile_picture?.trim()
                            ? ([
                                {
                                  id: "google" as const,
                                  icon: "",
                                  title: "Use Google photo",
                                  desc: "From your Google account",
                                },
                              ] as const)
                            : []),
                        ] as const
                      ).map((row) => (
                        <div
                          key={row.id}
                          className="mb-1 border-b border-slate-100 last:mb-0 last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoAccordion((c) => (c === row.id ? null : row.id))
                            }
                            className="flex w-full min-h-[48px] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                          >
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center"
                              aria-hidden
                            >
                              {row.id === "google" ? (
                                <Image
                                  src="/brands/google.svg"
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="h-6 w-6"
                                />
                              ) : (
                                <span className="text-2xl">{row.icon}</span>
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900">{row.title}</p>
                              <p className="text-xs text-slate-500">{row.desc}</p>
                            </div>
                            <span className="text-slate-400">
                              {photoAccordion === row.id ? "▴" : "▾"}
                            </span>
                          </button>
                          {photoAccordion === "upload" && row.id === "upload" ? (
                            <div className="px-2 pb-3 pt-0">
                              {uploadPreview ? (
                                <div className="flex flex-col items-center gap-2">
                                  <div
                                    className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full bg-slate-100"
                                    style={{ border: `2px solid ${PINK_RING}` }}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={uploadPreview}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <p className="text-center text-xs text-slate-500">
                                    Selected for save — use &quot;Save and continue&quot; below
                                  </p>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-[#FAFAFA] px-4 py-6"
                                >
                                  <p className="text-sm font-bold text-slate-900">Upload from device</p>
                                  <p className="text-xs text-slate-500">JPG, PNG, WEBP</p>
                                </button>
                              )}
                            </div>
                          ) : null}
                          {photoAccordion === "emoji" && row.id === "emoji" ? (
                            <div className="px-2 pb-3">
                              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                                {TRAVEL_EMOJIS.map((e) => (
                                  <button
                                    key={e}
                                    type="button"
                                    onClick={() => onPickEmoji(e)}
                                    className={`flex aspect-square min-h-[44px] items-center justify-center rounded-lg border-2 text-2xl ${
                                      modalEmojiPick === e ? "bg-rose-50" : "bg-white"
                                    }`}
                                    style={{
                                      borderColor: modalEmojiPick === e ? CORAL : "#E5E7EB",
                                    }}
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                              {modalEmojiPick && pendingAvatarUrl === modalEmojiPick ? (
                                <p className="mt-2 text-center text-xs text-slate-500">
                                  Selected for save
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {photoAccordion === "auto" && row.id === "auto" ? (
                            <div className="flex flex-col items-center gap-2 px-2 pb-3">
                              <div
                                className="h-20 w-20 overflow-hidden rounded-full border-2"
                                style={{ borderColor: PINK_RING }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={autoDicebearUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  width={80}
                                  height={80}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={onPickDicebear}
                                className="min-h-[44px] w-full max-w-xs rounded-xl text-sm font-bold text-white"
                                style={{ backgroundColor: CRIMSON }}
                              >
                                Use this auto avatar
                              </button>
                            </div>
                          ) : null}
                          {photoAccordion === "google" && row.id === "google" && me?.profile_picture?.trim() ? (
                            <div className="flex flex-col items-center gap-2 px-2 pb-3">
                              <div
                                className="h-[100px] w-[100px] overflow-hidden rounded-full bg-slate-100"
                                style={{ border: `2px solid ${PINK_RING}` }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={me.profile_picture}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={onPickGooglePhoto}
                                className="min-h-[44px] w-full max-w-xs rounded-xl text-sm font-bold text-white"
                                style={{ backgroundColor: CRIMSON }}
                              >
                                Use Google photo
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {pendingAvatarUrl && photoPickerOpen ? (
                    <p className="mt-2 text-xs text-slate-500">
                      A new photo is ready — it will be saved when you press &quot;Save and continue&quot;.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-slate-900">Verification &amp; connections</h2>
            <p className="mt-1 text-sm text-slate-600">
              Complete each item to improve account security and reachability.
            </p>

            <div className="mt-6 space-y-4">
              {/* Email */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Email</p>
                    <p className="text-xs text-slate-600">{me?.email ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={emailOk}
                      okLabel="Verified ✓"
                      badLabel="Not verified"
                    />
                    {!emailOk ? (
                      <button
                        type="button"
                        onClick={onEmailVerify}
                        disabled={emailVerifyBusy}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                        style={{ backgroundColor: TEAL }}
                      >
                        {emailVerifyBusy ? "Sending…" : "Verify"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {emailVerifyOk ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Verification link sent to your email
                  </p>
                ) : null}
                {emailVerifyErr ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{emailVerifyErr}</p>
                ) : null}
              </div>

              {/* Phone */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Phone</p>
                    <p className="text-xs text-slate-600">SMS one-time code</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={phoneOk}
                      okLabel="Verified ✓"
                      badLabel="Not verified"
                    />
                    {showPhoneFlow ? (
                      <button
                        type="button"
                        onClick={onPhoneSendOtp}
                        disabled={phoneBusy}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                        style={{ backgroundColor: TEAL }}
                      >
                        {phoneOtpSent ? "Resend code" : "Verify"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {showPhoneFlow ? (
                  <>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <label className="shrink-0 sm:w-48">
                        <span className="sr-only">Country</span>
                        <select
                          value={phoneDial}
                          onChange={(e) => setPhoneDial(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                        >
                          {COUNTRY_DIAL_OPTIONS.map((o) => (
                            <option key={`${o.label}-${o.value}`} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                        placeholder="Phone number"
                        autoComplete="tel-national"
                      />
                    </div>
                    {phoneOtpSent ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={phoneOtp}
                          onChange={(e) =>
                            setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                          placeholder="Enter OTP"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                        <button
                          type="button"
                          onClick={onPhoneVerifyOtp}
                          disabled={phoneBusy || phoneOtp.trim().length < 6}
                          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                          style={{ backgroundColor: NAVY }}
                        >
                          {phoneBusy ? "…" : "Verify"}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">
                    {me?.phone && String(me.phone).trim()
                      ? `On file: ${me.phone}`
                      : null}
                  </p>
                )}
                {phoneErr ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{phoneErr}</p>
                ) : null}
              </div>

              {/* Google */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/brands/google.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Google</p>
                      <p className="text-xs text-slate-600">Account linked for sign-in</p>
                    </div>
                  </div>
                  <StatusPill
                    ok={googleOk}
                    okLabel="Connected ✓"
                    badLabel="Not connected"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">WhatsApp</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={waOk}
                      okLabel="Verified ✓"
                      badLabel="Not verified"
                    />
                    {showWaFlow ? (
                      <button
                        type="button"
                        onClick={onWhatsAppSendOtp}
                        disabled={waBusy}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                        style={{ backgroundColor: TEAL }}
                      >
                        {waOtpSent ? "Resend code" : "Verify"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {showWaFlow ? (
                  <>
                    <p className="mt-0.5 text-xs text-slate-600">We&apos;ll send a one-time code</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <label className="shrink-0 sm:w-48">
                        <span className="sr-only">Country</span>
                        <select
                          value={waDial}
                          onChange={(e) => setWaDial(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                        >
                          {COUNTRY_DIAL_OPTIONS.map((o, idx) => (
                            <option key={`${o.label}-${idx}`} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        value={waLocal}
                        onChange={(e) => setWaLocal(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                        placeholder="Phone number"
                        autoComplete="tel-national"
                      />
                    </div>
                    {waOtpSent ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={waOtp}
                          onChange={(e) =>
                            setWaOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                          placeholder="Enter OTP"
                          inputMode="numeric"
                        />
                        <button
                          type="button"
                          onClick={onWhatsAppVerifyOtp}
                          disabled={waBusy || waOtp.trim().length < 6}
                          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                          style={{ backgroundColor: NAVY }}
                        >
                          {waBusy ? "…" : "Verify"}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {waErr ? <p className="mt-2 text-xs font-medium text-rose-600">{waErr}</p> : null}
              </div>

              {/* Instagram */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Instagram</p>
                  <StatusPill
                    ok={igOk}
                    okLabel="Saved ✓"
                    badLabel="Not saved"
                  />
                </div>
                <p className="mt-0.5 text-xs text-slate-600">@username on your public profile</p>
                {igOk ? (
                  <p className="mt-2 text-sm text-slate-800">
                    {(me?.instagram_handle || "").trim()}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-slate-700">Handle</span>
                      <input
                        value={instagram}
                        onChange={(e) => {
                          setInstagram(e.target.value);
                          setInstagramErr(null);
                        }}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#E94560]/30 focus:ring-2"
                        placeholder="@yourhandle"
                        autoComplete="off"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={onSaveInstagram}
                      disabled={instagramSaveBusy}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                      style={{ backgroundColor: TEAL }}
                    >
                      {instagramSaveBusy ? "Saving…" : "Save"}
                    </button>
                    {normalizeInstagramHandle(instagram) ? (
                      <button
                        type="button"
                        onClick={onVerifyInstagram}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                      >
                        Open in Instagram
                      </button>
                    ) : null}
                  </div>
                )}
                {instagramErr ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{instagramErr}</p>
                ) : null}
              </div>

              {/* Google Drive */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Google Drive</p>
                    <p className="text-xs text-slate-600">Trip files and uploads</p>
                  </div>
                  {gdriveOk ? (
                    <span className="text-sm font-semibold text-emerald-700">Connected ✓</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onConnectGoogleDrive}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                      style={{ backgroundColor: NAVY }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {saveErr ? <p className="text-sm font-medium text-rose-600">{saveErr}</p> : null}

          <div className="border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saveBusy || !me}
              className="w-full rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-60 sm:w-auto"
              style={{ backgroundColor: NAVY }}
            >
              {saveBusy ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Your account status</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              You&apos;re signed in as{" "}
              <span className="font-semibold text-slate-800">{me?.email ?? "…"}</span>.
              Finishing setup unlocks the best experience across Travel Hub and trips.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Why verify?</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Verified email and phone help us protect your account, reset passwords, and notify you
              about trips and expenses.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Tips</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
              <li>Use a clear profile photo so group members recognize you.</li>
              <li>Recovery email should differ from your login email.</li>
              <li>You can update everything later in Settings.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Need help?</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Visit Settings or contact support from your profile. For OAuth issues, try signing out
              and linking Google again.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
