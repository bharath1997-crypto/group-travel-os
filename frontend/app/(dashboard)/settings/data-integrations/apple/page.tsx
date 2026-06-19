"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Apple,
  ArrowUpRight,
  Calendar,
  Download,
  Eye,
  Info,
  MapPin,
  Navigation,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import {
  SettingsHubRow,
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import { SettingsBreadcrumb, dataCrumbs } from "@/components/settings/SettingsBreadcrumb";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  note: string | null;
  flag_type: string;
}

// ── Apple Maps URL helpers ────────────────────────────────────────────────────

function appleMapDeepLink(name: string, lat: number, lng: number): string {
  return `maps://?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
}

function appleMapWebUrl(name: string, lat: number, lng: number): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
}

// ── Static info/notice row ────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  sublabel,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
        <Icon size={16} className="text-stone-600" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] leading-snug text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-stone-400">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppleIntegrationPage() {
  const [pins, setPins]         = useState<Pin[]>([]);
  const [loadingPins, setLoadingPins] = useState(true);

  const fetchPins = useCallback(async () => {
    try {
      const data = await apiFetch<Pin[]>("/api/v1/pins");
      setPins(data);
    } catch {
      // swallow — pins section will show empty state
    } finally {
      setLoadingPins(false);
    }
  }, []);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  return (
    <>
      <SettingsScreenHeader title="Apple Integration" backHref="/settings/data-integrations" />
      <SettingsBreadcrumb crumbs={dataCrumbs("Apple Integration")} />

      {/* ── 1. Apple Calendar ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Apple Calendar</SettingsSectionTitle>

        <SettingsHubRow
          href="/settings/data-integrations/export-trips"
          icon={Calendar}
          label="Export Trips as .ics"
          sublabel="Download your trips as a Calendar file and import into Apple Calendar"
          accentColor="blue"
        />

        {/* Instructions */}
        <div className="border-b border-stone-100 bg-stone-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200">
              <Info size={13} className="text-stone-500" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] font-medium text-neutral-700">
                How to import into Apple Calendar
              </p>
              <ol className="mt-1.5 space-y-1 text-[12px] text-stone-500">
                <li>1. Go to Export Trips and download your trips as a <strong>.ics</strong> file</li>
                <li>2. Open the downloaded file on your iPhone, iPad, or Mac</li>
                <li>3. Tap <strong>Add All</strong> when prompted by the Calendar app</li>
              </ol>
            </div>
          </div>
        </div>

        <InfoRow
          icon={Smartphone}
          label="Works on all Apple devices"
          sublabel="Import into Calendar on iPhone, iPad, or Mac — no account connection needed"
        />
      </div>

      {/* ── 2. Apple Maps ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Apple Maps</SettingsSectionTitle>

        {loadingPins ? (
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
            <p className="text-[14px] text-stone-400">Loading saved places…</p>
          </div>
        ) : pins.length === 0 ? (
          <div className="border-b border-stone-100 px-4 py-5">
            <p className="text-[14px] font-medium text-neutral-900">No saved places</p>
            <p className="mt-1 text-[13px] text-stone-400">
              Save places on the map to open them in Apple Maps.
            </p>
          </div>
        ) : (
          pins.map((pin) => {
            const deepLink = appleMapDeepLink(pin.name, pin.latitude, pin.longitude);
            const webUrl   = appleMapWebUrl(pin.name, pin.latitude, pin.longitude);

            return (
              <div
                key={pin.id}
                className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                  <MapPin size={15} className="text-stone-500" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-neutral-900">{pin.name}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                  </p>
                </div>
                {/* Try native deep link; fall back to web URL for non-Apple devices */}
                <a
                  href={deepLink}
                  onClick={(e) => {
                    // On non-Apple devices the maps:// scheme will fail silently.
                    // After a short delay, fall back to the web URL.
                    const t = setTimeout(() => {
                      window.open(webUrl, "_blank", "noopener");
                    }, 300);
                    // If the page goes hidden (app opened), cancel the fallback
                    const cancel = () => { clearTimeout(t); window.removeEventListener("visibilitychange", cancel); };
                    window.addEventListener("visibilitychange", cancel, { once: true });
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-[12px] font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-50"
                  data-testid={`apple-maps-link-${pin.id}`}
                  data-deep-link={deepLink}
                  data-web-url={webUrl}
                >
                  <Navigation size={11} strokeWidth={2} />
                  Open
                </a>
              </div>
            );
          })
        )}

        <InfoRow
          icon={ArrowUpRight}
          label="Opens in Maps app on Apple devices"
          sublabel="On other devices, opens Apple Maps in the browser"
        />
      </div>

      {/* ── 3. Sign in with Apple ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Sign in with Apple</SettingsSectionTitle>
        <SettingsHubRow
          icon={Apple}
          label="Apple Account"
          sublabel="Sign in with your Apple ID"
          badge="Coming Soon"
          accentColor="blue"
        />
      </div>

      {/* ── 4. Privacy Notice ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Privacy</SettingsSectionTitle>
        <InfoRow
          icon={ShieldCheck}
          label="No Apple account access"
          sublabel="Rovvy does not access your Apple account data"
        />
        <InfoRow
          icon={Smartphone}
          label="Device-native features"
          sublabel="Apple integrations use device-native features when available — no cloud connection required"
        />
        <InfoRow
          icon={Eye}
          label="Your data stays yours"
          sublabel="Calendar exports and Maps links are generated locally — Rovvy does not share data with Apple"
        />
      </div>

      {/* Footer */}
      <div className="pb-10 pt-4 text-center">
        <p className="text-[12px] text-stone-400">
          Questions?{" "}
          <a
            href="mailto:privacy@rovvy.app"
            className="text-[#0F766E] underline-offset-2 hover:underline"
          >
            privacy@rovvy.app
          </a>
        </p>
      </div>

      <SettingsPageFooter />
    </>
  );
}
