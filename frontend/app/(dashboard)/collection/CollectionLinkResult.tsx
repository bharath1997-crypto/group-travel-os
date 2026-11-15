"use client";

import { useState } from "react";

import { parseTags } from "./collection-edit";
import { candidateToBody, draftFromCandidate, type CandidateDraft, type linkOnlyBody } from "./collection-link";
import type { CollectionItem, ExtractCandidate, ExtractLinkResponse, Friend } from "./collection-types";
import styles from "./collection.module.css";
import FriendPicker from "./FriendPicker";
import LinkPreview from "./LinkPreview";

type Body = ReturnType<typeof candidateToBody>;
type Props = {
  result: ExtractLinkResponse;
  url: string;
  friends: Friend[];
  friendsUnavailable?: boolean;
  /** Saves the body and returns the saved row (or null when it failed). */
  onSave: (body: Body | ReturnType<typeof linkOnlyBody>) => Promise<CollectionItem | null>;
  /** Sends a saved row to friends' Unsorted. Returns true when it worked. */
  onShare: (itemId: string, friendIds: string[]) => Promise<boolean>;
  /** Adds tags / sends friends the link row that was saved automatically when it was pasted. */
  onApplyToLink: (tags: string[], friendIds: string[]) => Promise<boolean>;
};

const key = (c: ExtractCandidate) => c.saved_from ?? c.name;

export default function CollectionLinkResult({ result, url, friends, friendsUnavailable, onSave, onShare, onApplyToLink }: Props) {
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>(() =>
    Object.fromEntries(result.candidates.map((c) => [key(c), draftFromCandidate(c)])),
  );
  const [saved, setSaved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(result.candidates.filter((c) => c.already_saved).map((c) => [key(c), true])),
  );
  const [busy, setBusy] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sentNote, setSentNote] = useState<string | null>(null);

  /** Save, then send to the picked friends. A failed send never undoes the save. */
  const saveAndShare = async (body: Body | ReturnType<typeof linkOnlyBody>): Promise<boolean> => {
    const item = await onSave(body);
    if (!item) return false;
    if (picked.length > 0) {
      const ok = await onShare(item.id, picked);
      setSentNote(
        ok
          ? `Sent to ${picked.length} ${picked.length === 1 ? "friend" : "friends"}.`
          : "Saved, but we could not send it to your friends. Try again from the card.",
      );
    }
    return true;
  };

  const saveOne = async (c: ExtractCandidate) => {
    const d = drafts[key(c)];
    if (!d || !d.name.trim() || saved[key(c)]) return;
    if (await saveAndShare(candidateToBody(c, d, null, parseTags(tagsInput)))) setSaved((s) => ({ ...s, [key(c)]: true }));
  };

  const saveAll = async () => {
    setBusy(true);
    try {
      for (const c of result.candidates) if (!saved[key(c)]) await saveOne(c);
    } finally {
      setBusy(false);
    }
  };

  const remaining = result.candidates.filter((c) => !saved[key(c)]).length;

  return (
    <div className={`${styles.extractResult} ${styles.cardDetailsPop}`} role="region" aria-label="Link result">
      {result.preview ? <LinkPreview preview={result.preview} title={result.source_title} url={result.source_url || url} /> : null}
      <p className={styles.extractMessage}>
        {result.source_title} — {result.source_label}. {result.message}
      </p>

      <div className={styles.shareOptions}>
        <label className={styles.editLabel}>
          <span className={styles.mono}>Tags (optional, comma separated)</span>
          <input
            value={tagsInput}
            maxLength={200}
            placeholder="date night, rainy day"
            aria-label="Tags for these saves"
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </label>
        <div className={styles.editLabel}>
          <span className={styles.mono}>Send to friends (optional)</span>
          <FriendPicker friends={friends} selected={picked} onChange={setPicked} disabled={busy} unavailable={friendsUnavailable} />
        </div>
        {sentNote ? <p className={styles.candidateHint} role="status">{sentNote}</p> : null}
      </div>

      {result.candidates.map((c) => {
        const k = key(c);
        const d = drafts[k] ?? draftFromCandidate(c);
        const isSaved = Boolean(saved[k]);
        const edit = (patch: Partial<CandidateDraft>) => setDrafts((s) => ({ ...s, [k]: { ...d, ...patch } }));
        return (
          <div key={k} className={styles.candidateRow}>
            <input aria-label={`Place name ${result.candidates.indexOf(c) + 1}`} value={d.name} disabled={isSaved} maxLength={200} onChange={(e) => edit({ name: e.target.value })} />
            <input aria-label={`City for ${d.name || "place"}`} placeholder="City" value={d.city} disabled={isSaved} maxLength={120} onChange={(e) => edit({ city: e.target.value })} />
            <input aria-label={`Category for ${d.name || "place"}`} placeholder="Category" value={d.category} disabled={isSaved} maxLength={80} onChange={(e) => edit({ category: e.target.value })} />
            <button type="button" className={styles.readBtn} disabled={isSaved || busy || !d.name.trim()} onClick={() => void saveOne(c)}>
              {isSaved ? (c.already_saved ? "Already saved" : "Saved ✓") : "Save"}
            </button>
            {!isSaved && (c.match_status !== "sure" || !d.city.trim()) ? (
              <span className={styles.candidateHint}>City not confirmed, goes to Unsorted</span>
            ) : null}
          </div>
        );
      })}

      {result.candidates.length > 1 && remaining > 0 ? (
        <button type="button" className={styles.readBtn} style={{ marginTop: 10 }} disabled={busy} onClick={() => void saveAll()}>
          {busy ? "Saving…" : `Save all (${remaining})`}
        </button>
      ) : null}

      {result.link_saved ? (
        <div style={{ marginTop: 10 }}>
          <p className={styles.candidateHint} role="status">
            Link saved in Unsorted ✓
          </p>
          {result.link_only ? (
            <button
              type="button"
              className={styles.readBtn}
              disabled={busy || (!tagsInput.trim() && picked.length === 0)}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await onApplyToLink(parseTags(tagsInput), picked);
                  setSentNote(ok ? "Tags and friends added to your saved link." : "Could not update the saved link.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add tags / send to friends
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
