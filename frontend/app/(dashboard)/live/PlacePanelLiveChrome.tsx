"use client";

import { useEffect, useMemo, useState } from "react";
import { BusFront, ThumbsUp, Users } from "lucide-react";
import { CarSideDoorOpenIcon } from "./live-car-door-open-icon";
import type { LiveLocationContext } from "./live-location-context";
import type { PlacePreviewData } from "./live-place-preview-data";
import LiveAiSuggestionsBlock from "./LiveAiSuggestionsBlock";
import PlaceWikiAboutSection from "./PlaceWikiAboutSection";
import { LiveDataTrustBadge } from "./LiveDataTrustBadge";
import type { LiveAiSuggestionItem } from "./live-ai-suggestions";
import {
  formatPlaceSubtitle,
  getPlaceLocationFields,
  resolvePlaceCategoryLabel,
} from "./live-place-display";
import {
  VEHICLE_PREFERENCE_OPTIONS,
  type VehiclePreference,
} from "./live-types";
import { usePlaceWikiSummary } from "./use-place-wiki-summary";
import styles from "./PlacePanel.module.css";

export type PlacePanelLiveChromeProps = {
  preview: PlacePreviewData;
  mapZoom?: number | null;
  locationContext?: LiveLocationContext | null;
  aiSuggestions: LiveAiSuggestionItem[];
  vehiclePreference: VehiclePreference;
  onVehiclePreferenceChange: (value: VehiclePreference) => void;
  onPutToVote?: () => void;
  onInviteGroup?: () => void;
  onAddLocation?: () => void;
  onStartDirection?: () => void;
  directionReady?: boolean;
  directionLoading?: boolean;
  onOpenTravelTab?: () => void;
};

function GroupSection({
  onPutToVote,
  onInviteGroup,
}: Pick<PlacePanelLiveChromeProps, "onPutToVote" | "onInviteGroup">) {
  return (
    <div className={styles.liveGroupSection}>
      <button type="button" className={styles.putToVoteBtn} onClick={onPutToVote}>
        <ThumbsUp size={14} strokeWidth={2} aria-hidden />
        Put to vote
      </button>

      <div className={styles.whosGoing}>
        <div className={styles.whosGoingHeader}>
          <div className={styles.whosGoingTitle}>
            <Users size={16} strokeWidth={2} aria-hidden />
            <span>Who&apos;s going</span>
          </div>
          <button type="button" className={styles.inviteLink} onClick={onInviteGroup}>
            Invite
          </button>
        </div>
        <p className={styles.whosGoingCopy}>
          Friends show up here when they vote or go live. Group Live coming soon.
        </p>
        <div className={styles.avatarStack} aria-hidden>
          {["A", "T", "S"].map((initial) => (
            <span key={initial} className={styles.avatarChip}>
              {initial}
            </span>
          ))}
          <span className={`${styles.avatarChip} ${styles.avatarOverflow}`}>+2</span>
        </div>
      </div>
    </div>
  );
}

function TravelFooter({
  vehiclePreference,
  onVehiclePreferenceChange,
  onAddLocation,
  onStartDirection,
  directionReady = false,
  directionLoading = false,
  onOpenTravelTab,
}: Pick<
  PlacePanelLiveChromeProps,
  | "vehiclePreference"
  | "onVehiclePreferenceChange"
  | "onAddLocation"
  | "onStartDirection"
  | "directionReady"
  | "directionLoading"
  | "onOpenTravelTab"
>) {
  return (
    <div className={styles.liveTravelFooter}>
      <p className={styles.liveTravelLabel}>How are you traveling?</p>
      <div className={styles.liveTravelGrid}>
        {VEHICLE_PREFERENCE_OPTIONS.map((option) => {
          const isActive = vehiclePreference === option.id;
          const TravelIcon = option.id === "private" ? CarSideDoorOpenIcon : BusFront;
          return (
            <button
              key={option.id}
              type="button"
              className={`${styles.liveTravelCard} ${isActive ? styles.liveTravelCardActive : ""}`}
              onClick={() => {
                onVehiclePreferenceChange(option.id);
                if (option.id === "public") onOpenTravelTab?.();
              }}
            >
              <span className={styles.liveTravelCardIcon} aria-hidden>
                <TravelIcon size={18} strokeWidth={2} />
              </span>
              <span className={styles.liveTravelCardTitle}>{option.label}</span>
              <span className={styles.liveTravelCardBody}>{option.description}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.liveTravelActions}>
        <button type="button" className={styles.liveAddLocationBtn} onClick={onAddLocation}>
          Add location
        </button>
        <button
          type="button"
          className={styles.liveStartDirectionBtn}
          onClick={onStartDirection}
          disabled={!directionReady || directionLoading}
        >
          {directionLoading ? "Loading route…" : "Start a direction"}
        </button>
      </div>
    </div>
  );
}

export default function PlacePanelLiveChrome({
  preview,
  mapZoom = null,
  locationContext = null,
  aiSuggestions,
  vehiclePreference,
  onVehiclePreferenceChange,
  onPutToVote,
  onInviteGroup,
  onAddLocation,
  onStartDirection,
  directionReady = false,
  directionLoading = false,
  onOpenTravelTab,
}: PlacePanelLiveChromeProps) {
  const [activeTab, setActiveTab] = useState<"guide" | "about" | "info">("guide");
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const { wikiSummary, wikiLoading } = usePlaceWikiSummary(preview);

  useEffect(() => {
    setActiveTab("guide");
    setWikiExpanded(false);
  }, [preview.lat, preview.lng, preview.name]);

  const locationFields = useMemo(() => getPlaceLocationFields(preview), [preview]);
  const categoryLabel = resolvePlaceCategoryLabel(preview);

  return (
    <>
      <GroupSection onPutToVote={onPutToVote} onInviteGroup={onInviteGroup} />

      <div className={styles.liveTabs} role="tablist" aria-label="Place details">
        {(["guide", "about", "info"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.liveTab} ${activeTab === tab ? styles.liveTabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.liveTabPanel}>
        {activeTab === "guide" ? (
          <div className={styles.liveTabContent}>
            <div className={styles.aiEstimateHeader}>
              <span className={styles.aiEstimateEyebrow}>AI estimate</span>
              <span className={styles.aiEstimateSub}>Route tips from map context</span>
            </div>
            <LiveAiSuggestionsBlock
              suggestions={aiSuggestions}
              destinationName={preview.name}
              showEmptyState
            />
            {locationContext && locationContext.classification !== "local_place" ? (
              <div className={styles.contextNotice}>
                <LiveDataTrustBadge variant="area" />
                <p>{locationContext.template?.recommendation}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "about" ? (
          <div className={styles.liveTabContent}>
            <PlaceWikiAboutSection
              wikiLoading={wikiLoading}
              wikiSummary={wikiSummary}
              placeName={preview.name}
              city={preview.city}
              wikiExpanded={wikiExpanded}
              onExpand={() => setWikiExpanded(true)}
            />
          </div>
        ) : null}

        {activeTab === "info" ? (
          <div className={styles.liveTabContent}>
            {preview.mapPresenceNote ? (
              <p className={styles.infoLine}>{preview.mapPresenceNote}</p>
            ) : null}
            {locationFields.length > 0 ? (
              <ul className={styles.infoList}>
                {locationFields.map((field) => (
                  <li key={`${field.label}-${field.value}`}>
                    <span className={styles.infoLabel}>{field.label}</span>
                    <span>{field.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.coordinatesLabel ? (
              <p className={styles.infoCoords}>{preview.coordinatesLabel}</p>
            ) : null}
            {preview.openingHours ? (
              <p className={styles.infoLine}>
                Hours: {preview.openingHours}
                {preview.openStatus ? ` (${preview.openStatus})` : ""}
              </p>
            ) : null}
            {!preview.mapPresenceNote &&
            locationFields.length === 0 &&
            !preview.coordinatesLabel &&
            !preview.openingHours ? (
              <p className={styles.infoLine}>
                {formatPlaceSubtitle(preview, mapZoom)} — verified from OpenStreetMap pick data.
              </p>
            ) : null}
            <p className={styles.infoCategory}>Category: {categoryLabel}</p>
          </div>
        ) : null}
      </div>

      <TravelFooter
        vehiclePreference={vehiclePreference}
        onVehiclePreferenceChange={onVehiclePreferenceChange}
        onAddLocation={onAddLocation}
        onStartDirection={onStartDirection}
        directionReady={directionReady}
        directionLoading={directionLoading}
        onOpenTravelTab={onOpenTravelTab}
      />
    </>
  );
}
