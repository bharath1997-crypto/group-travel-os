"use client";

import { useEffect, useState } from "react";

import { buildEditPatch, draftFromItem, nextStars, parseTags } from "./collection-edit";
import type { CollectionItem, CollectionItemPatch, CollectionSummary, Friend } from "./collection-types";
import styles from "./collection.module.css";
import { buildShareUrl, shareText } from "./collection-share-link";
import FriendPicker from "./FriendPicker";

type Props = {
  item: CollectionItem;
  collections: CollectionSummary[];
  friends: Friend[];
  friendsUnavailable?: boolean;
  onShare: (itemId: string, friendIds: string[]) => Promise<boolean>;
  onPatch: (id: string, patch: CollectionItemPatch) => Promise<boolean>;
  onRemove: (item: CollectionItem) => Promise<void>;
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill={filled ? "#D8A23A" : "rgba(15,22,20,0.16)"} stroke={filled ? "#D8A23A" : "rgba(15,22,20,0.16)"} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 3.6l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17.5l-5.6 3.1 1.3-6.2L3 10.1l6.3-.7z" />
    </svg>
  );
}

export default function CollectionCardEditor({ item, collections, friends, friendsUnavailable, onShare, onPatch, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFromItem(item));
  const [busy, setBusy] = useState(false);
  const [tagsInput, setTagsInput] = useState((item.tags ?? []).join(", "));
  const [sharing, setSharing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);

  // The card is no longer remounted on every save (that threw away what you were typing).
  // Keep the tag box in step with what the server stored (it lower-cases and tidies tags).
  const savedTags = (item.tags ?? []).join(", ");
  useEffect(() => {
    setTagsInput(savedTags);
  }, [savedTags]);

  const run = async (fn: () => Promise<boolean | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const saveTags = () =>
    run(async () => {
      const next = parseTags(tagsInput);
      if (next.join("|") === (item.tags ?? []).join("|")) return;
      await onPatch(item.id, { tags: next });
    });

  /** Phone share menu (WhatsApp, Messages...). Falls back to copying the Rovvy link. */
  const shareOut = async () => {
    const url = buildShareUrl(window.location.origin, item);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: item.name, text: shareText(item), url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user closed the menu
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied. Paste it in any chat.");
    } catch {
      setShareNote("Could not open the share menu. Try again from your phone.");
    }
  };

  const send = () =>
    run(async () => {
      if (picked.length === 0) return;
      const ok = await onShare(item.id, picked);
      setShareNote(ok ? `Sent to ${picked.length} ${picked.length === 1 ? "friend" : "friends"}.` : "Could not send. Try again.");
      if (ok) {
        setPicked([]);
        setSharing(false);
      }
    });

  const save = () =>
    run(async () => {
      const patch = buildEditPatch(item, draft);
      if (!patch) return;
      if (Object.keys(patch).length === 0) {
        setEditing(false);
        return;
      }
      if (await onPatch(item.id, patch)) setEditing(false);
    });

  return (
    <div className={styles.editor}>
      <div className={styles.noteHeader}>
        <span className={`${styles.noteLabel} ${styles.mono}`}>Your rating</span>
        <span role="group" aria-label="Your rating" style={{ display: "flex", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.starBtn}
              aria-label={`Rate ${n} of 5`}
              aria-pressed={item.stars >= n}
              disabled={busy}
              onClick={() => void run(() => onPatch(item.id, { stars: nextStars(item.stars, n) }))}
            >
              <Star filled={item.stars >= n} />
            </button>
          ))}
        </span>
      </div>

      {editing ? (
        <div className={styles.editForm}>
          <label className={styles.editLabel}>
            <span className={styles.mono}>Name</span>
            <input value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className={styles.editLabel}>
            <span className={styles.mono}>City</span>
            <input value={draft.city} maxLength={120} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          </label>
          <label className={styles.editLabel}>
            <span className={styles.mono}>Category</span>
            <input value={draft.category} maxLength={80} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          </label>
          <label className={styles.editLabel}>
            <span className={styles.mono}>Your note</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={draft.note}
              placeholder="What made you save it?"
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          {!draft.name.trim() ? <p className={styles.editHint}>A name is required.</p> : null}
          <div className={styles.editActions}>
            <button type="button" className={styles.readBtn} disabled={busy || !draft.name.trim()} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={styles.filterBtn}
              disabled={busy}
              onClick={() => {
                setDraft(draftFromItem(item));
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`${styles.noteBox} ${item.note ? "" : styles.noteEmpty}`}>
            {item.note || "No note yet."}
          </div>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setDraft(draftFromItem(item));
              setEditing(true);
            }}
          >
            Edit name, place and note
          </button>
        </>
      )}

      <label className={styles.editLabel} style={{ marginTop: 10 }}>
        <span className={styles.mono}>Collection</span>
        <select
          value={item.collection_id ?? ""}
          disabled={busy}
          onChange={(e) => void run(() => onPatch(item.id, { collection_id: e.target.value || null }))}
        >
          <option value="">No collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.editLabel} style={{ marginTop: 10 }}>
        <span className={styles.mono}>Tags (comma separated)</span>
        <input
          value={tagsInput}
          maxLength={200}
          disabled={busy}
          placeholder="date night, rainy day"
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={() => void saveTags()}
        />
      </label>

      <div style={{ marginTop: 10 }}>
        {sharing ? (
          <>
            <FriendPicker friends={friends} selected={picked} onChange={setPicked} disabled={busy} unavailable={friendsUnavailable} />
            <div className={styles.editActions}>
              <button type="button" className={styles.readBtn} disabled={busy || picked.length === 0} onClick={() => void send()}>
                {busy ? "Sending…" : "Send"}
              </button>
              <button type="button" className={styles.filterBtn} disabled={busy} onClick={() => setSharing(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button type="button" className={styles.linkBtn} onClick={() => void shareOut()}>
              Share
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setShareNote(null);
                setSharing(true);
              }}
            >
              Send to Rovvy friends
            </button>
          </div>
        )}
        {shareNote ? (
          <p className={styles.candidateHint} role="status">
            {shareNote}
          </p>
        ) : null}
      </div>

      <div className={styles.cardActions}>
        {item.is_unsorted ? (
          <button
            type="button"
            className={styles.readBtn}
            disabled={busy}
            onClick={() => void run(() => onPatch(item.id, { is_unsorted: false }))}
          >
            File it
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void run(() => onRemove(item))}
          className={styles.removeBtn}
          disabled={busy}
          aria-label={`Remove ${item.name}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
