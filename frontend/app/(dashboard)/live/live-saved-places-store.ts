/**
 * Local-only saved places for Live map — never sent to Rovvy servers.
 * Metadata in localStorage; photos/audio/files in IndexedDB on this device.
 */

import type { PlacePreviewData } from "./PlacePreviewCard";

export type LiveSavedPlaceAttachmentKind = "photo" | "audio" | "file";

export type LiveSavedPlaceAttachmentMeta = {
  id: string;
  kind: LiveSavedPlaceAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type LiveSavedPlace = {
  id: string;
  name: string;
  categoryLabel: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  attachments: LiveSavedPlaceAttachmentMeta[];
  savedAt: string;
  updatedAt: string;
  placeKey?: string;
};

export const SAVED_PLACES_CHANGED_EVENT = "rovvy:saved-places-changed";
const STORAGE_KEY = "rovvy_live_saved_places_v1";
const IDB_NAME = "rovvy_live_saved_places";
const IDB_STORE = "blobs";

const COORD_MATCH_M = 45;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function emitChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SAVED_PLACES_CHANGED_EVENT));
}

function readAll(): LiveSavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveSavedPlace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(places: LiveSavedPlace[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    emitChanged();
  } catch {
    /* quota / private mode */
  }
}

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function blobKey(placeId: string, attachmentId: string): string {
  return `${placeId}:${attachmentId}`;
}

function inferAttachmentKind(file: File): LiveSavedPlaceAttachmentKind {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export function listLiveSavedPlaces(): LiveSavedPlace[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getLiveSavedPlace(id: string): LiveSavedPlace | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function findLiveSavedPlaceMatch(
  lat: number,
  lng: number,
  placeKey?: string | null,
): LiveSavedPlace | null {
  const places = readAll();
  if (placeKey) {
    const byKey = places.find((p) => p.placeKey && p.placeKey === placeKey);
    if (byKey) return byKey;
  }
  return (
    places.find((p) => haversineM(p.lat, p.lng, lat, lng) <= COORD_MATCH_M) ?? null
  );
}

export function isLivePlaceSaved(
  lat: number,
  lng: number,
  placeKey?: string | null,
): boolean {
  return findLiveSavedPlaceMatch(lat, lng, placeKey) != null;
}

export function saveLivePlaceFromPreview(place: PlacePreviewData): LiveSavedPlace {
  const existing = findLiveSavedPlaceMatch(place.lat, place.lng, place.placeKey);
  const stamp = nowIso();
  if (existing) {
    const updated: LiveSavedPlace = {
      ...existing,
      name: place.name.trim() || existing.name,
      categoryLabel: place.categoryLabel || existing.categoryLabel,
      address: place.address || existing.address,
      lat: place.lat,
      lng: place.lng,
      placeKey: place.placeKey ?? existing.placeKey,
      updatedAt: stamp,
    };
    writeAll(readAll().map((p) => (p.id === existing.id ? updated : p)));
    return updated;
  }

  const created: LiveSavedPlace = {
    id: newId(),
    name: place.name.trim() || "Saved place",
    categoryLabel: place.categoryLabel || "Place",
    address: place.address || "",
    lat: place.lat,
    lng: place.lng,
    notes: "",
    attachments: [],
    savedAt: stamp,
    updatedAt: stamp,
    placeKey: place.placeKey,
  };
  writeAll([created, ...readAll()]);
  return created;
}

export function updateLiveSavedPlaceNotes(id: string, notes: string): LiveSavedPlace | null {
  const places = readAll();
  const idx = places.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const next = { ...places[idx], notes, updatedAt: nowIso() };
  places[idx] = next;
  writeAll(places);
  return next;
}

export async function addLiveSavedPlaceAttachment(
  placeId: string,
  file: File,
): Promise<LiveSavedPlaceAttachmentMeta | null> {
  const places = readAll();
  const idx = places.findIndex((p) => p.id === placeId);
  if (idx < 0) return null;

  const meta: LiveSavedPlaceAttachmentMeta = {
    id: newId(),
    kind: inferAttachmentKind(file),
    name: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    createdAt: nowIso(),
  };

  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(file, blobKey(placeId, meta.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB write failed"));
    });
    db.close();
  } catch {
    return null;
  }

  const place = places[idx];
  const updated: LiveSavedPlace = {
    ...place,
    attachments: [meta, ...place.attachments],
    updatedAt: nowIso(),
  };
  places[idx] = updated;
  writeAll(places);
  return meta;
}

export async function getLiveSavedPlaceAttachmentBlob(
  placeId: string,
  attachmentId: string,
): Promise<Blob | null> {
  try {
    const db = await openBlobDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(blobKey(placeId, attachmentId));
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IDB read failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function removeLiveSavedPlace(id: string): Promise<void> {
  const place = getLiveSavedPlace(id);
  if (!place) return;

  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      for (const att of place.attachments) {
        store.delete(blobKey(id, att.id));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
    });
    db.close();
  } catch {
    /* best effort */
  }

  writeAll(readAll().filter((p) => p.id !== id));
}

export async function removeLiveSavedPlaceAttachment(
  placeId: string,
  attachmentId: string,
): Promise<void> {
  const places = readAll();
  const idx = places.findIndex((p) => p.id === placeId);
  if (idx < 0) return;

  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(blobKey(placeId, attachmentId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
    });
    db.close();
  } catch {
    /* best effort */
  }

  const place = places[idx];
  places[idx] = {
    ...place,
    attachments: place.attachments.filter((a) => a.id !== attachmentId),
    updatedAt: nowIso(),
  };
  writeAll(places);
}
