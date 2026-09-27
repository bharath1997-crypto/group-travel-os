"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import PlacePanel from "./PlacePanel";
import type { PlacePanelLiveChromeProps } from "./PlacePanelLiveChrome";
import type { Place, PlaceDistance, PlaceSeed } from "./place-panel-types";

function mergePlaceDetail(
  preview: Partial<Place> | null | undefined,
  fetched: Partial<Place> | null,
): Partial<Place> | null {
  if (!preview && !fetched) return null;
  return { ...(preview ?? {}), ...(fetched ?? {}) };
}
import { fetchPlaceSpineDetail, fetchPlaceSpineNear } from "./live-place-spine";
import { isSpineGersId } from "./live-place-spine-seed";
import {
  buildLivePreviewPanelFrameStyle,
  LIVE_PREVIEW_DEFAULT_SIZE,
} from "./live-panel-size";
import {
  LIVE_SHEET_BOTTOM_ABOVE_ROUTE,
  LIVE_SHEET_BOTTOM_DEFAULT,
  LIVE_SHEET_BOTTOM_DESKTOP,
  LIVE_SHEET_BOTTOM_IMMERSIVE,
} from "./live-layout";
import { logRovvyLiveWarn } from "./live-gps";

const PLACE_PANEL_WIDTH = "min(384px, calc(100vw - 6rem))";

type Props = {
  seed: PlaceSeed;
  /** Reverse-geocoded preview fields from Live map selection. */
  preview?: Partial<Place> | null;
  open: boolean;
  distance?: PlaceDistance | null;
  groupSize?: number;
  inPlan?: boolean;
  isPhoneLayout?: boolean;
  isDesktop?: boolean;
  wayraChatOpen?: boolean;
  stackAboveRouteSummary?: boolean;
  immersive?: boolean;
  onClose: () => void;
  onDirections?: () => void;
  onTogglePlan?: () => void;
  onAskGroup?: () => void;
  onHoldSeats?: () => void;
  onReviewFirst?: () => void;
  onAddHours?: () => void;
  onAskTier1?: () => void;
  onSuggestEdit?: () => void;
  liveChrome?: PlacePanelLiveChromeProps | null;
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

function useDocumentMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export default function LivePlacePanelHost({
  seed,
  preview = null,
  open,
  distance = null,
  groupSize = 6,
  inPlan = false,
  isPhoneLayout: isPhoneLayoutProp,
  isDesktop: isDesktopProp,
  wayraChatOpen = false,
  stackAboveRouteSummary = true,
  immersive = false,
  onClose,
  onDirections,
  onTogglePlan,
  onAskGroup,
  onHoldSeats,
  onReviewFirst,
  onAddHours,
  onAskTier1,
  onSuggestEdit,
  liveChrome = null,
}: Props) {
  const [detail, setDetail] = useState<Partial<Place> | null>(null);
  const isPhoneLayoutQuery = useMediaQuery("(max-width: 767px)");
  const isDesktopQuery = useMediaQuery("(min-width: 768px)");
  const isPhoneLayout = isPhoneLayoutProp ?? isPhoneLayoutQuery;
  const isDesktop = isDesktopProp ?? isDesktopQuery;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDetail(null);

    const loadSpineDetail = async () => {
      try {
        const row = isSpineGersId(seed.gers_id)
          ? await fetchPlaceSpineDetail(seed.gers_id)
          : await fetchPlaceSpineNear(seed.lat, seed.lon);
        if (!cancelled) setDetail(row);
      } catch (err) {
        logRovvyLiveWarn("Place spine detail fetch failed", err);
      }
    };

    void loadSpineDetail();

    return () => {
      cancelled = true;
    };
  }, [open, seed.gers_id, seed.lat, seed.lon, seed.name]);

  const sheetBottomVar = isDesktop
    ? LIVE_SHEET_BOTTOM_DESKTOP
    : stackAboveRouteSummary
      ? LIVE_SHEET_BOTTOM_ABOVE_ROUTE
      : immersive
        ? LIVE_SHEET_BOTTOM_IMMERSIVE
        : LIVE_SHEET_BOTTOM_DEFAULT;

  const mounted = useDocumentMounted();

  const frameStyle: CSSProperties = useMemo(() => {
    const sheetVar = {
      ["--live-preview-sheet-bottom" as string]: sheetBottomVar,
    };

    if (isPhoneLayout) {
      return {
        ...sheetVar,
        position: "fixed",
        zIndex: 260,
        left: 0,
        right: 0,
        bottom: sheetBottomVar,
        width: "100%",
        maxWidth: "100%",
        pointerEvents: "auto",
      };
    }

    const anchored = buildLivePreviewPanelFrameStyle({
      sheetBottom: sheetBottomVar,
      isPhoneLayout,
      wayraChatOpen,
      isDesktop,
      size: LIVE_PREVIEW_DEFAULT_SIZE,
    });

    return {
      ...anchored,
      ...sheetVar,
      width: PLACE_PANEL_WIDTH,
      minWidth: "14rem",
      maxWidth: PLACE_PANEL_WIDTH,
      pointerEvents: "auto",
      zIndex: 260,
    };
  }, [isPhoneLayout, sheetBottomVar, wayraChatOpen, isDesktop]);

  const mergedDetail = useMemo(
    () => mergePlaceDetail(preview, detail),
    [preview, detail],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <PlacePanel
      seed={seed}
      detail={mergedDetail}
      distance={distance}
      groupSize={groupSize}
      inPlan={inPlan}
      open={open}
      onClose={onClose}
      onDirections={onDirections}
      onTogglePlan={onTogglePlan}
      onAskGroup={onAskGroup}
      onHoldSeats={onHoldSeats}
      onReviewFirst={onReviewFirst}
      onAddHours={onAddHours}
      onAskTier1={onAskTier1}
      onSuggestEdit={onSuggestEdit}
      liveChrome={liveChrome}
      style={frameStyle}
    />,
    document.body,
  );
}
