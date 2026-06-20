"use client";

import { Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { EmergencyContact } from "@/lib/live/group";

type EmergencyContactsSheetProps = {
  onClose: () => void;
  onSkip?: () => void;
};

export function EmergencyContactsSheet({ onClose, onSkip }: EmergencyContactsSheetProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<EmergencyContact[]>("/live/emergency-contacts");
      setContacts(data);
    } catch {
      setError("Could not load emergency contacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<EmergencyContact>("/live/emergency-contacts", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
      });
      setContacts((prev) => [...prev, created]);
      setName("");
      setPhone("");
    } catch {
      setError("Could not add contact. Maximum 5 allowed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/live/emergency-contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setError("Could not delete contact.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/50">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 px-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Emergency Contacts</h2>
            <p className="mt-1 text-sm text-stone-500">Added when you trigger SOS</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-teal-700" size={24} />
            </div>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900">{contact.name}</p>
                    <p className="text-xs text-stone-500">{contact.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(contact.id)}
                    disabled={busy}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
              {contacts.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-500">
                  No emergency contacts yet.
                </p>
              ) : null}
            </ul>
          )}

          {contacts.length < 5 ? (
            <div className="mt-4 space-y-2 border-t border-stone-200 pt-4">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                maxLength={100}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone (+1...)"
                maxLength={20}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || !name.trim() || !phone.trim()}
                onClick={() => void handleAdd()}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Add contact
              </button>
            </div>
          ) : (
            <p className="mt-4 text-center text-xs text-stone-500">Maximum 5 contacts</p>
          )}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-200 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-stone-500 hover:text-stone-700"
            >
              Skip for now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
