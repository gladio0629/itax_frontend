// What the driver typed during registration, kept in sessionStorage so the
// "Yordam" page, a return from the camera app or a reload doesn't lose it.
// Photo previews (object URLs) are not kept; the uploaded refs are.
// Cleared on sign-out and once the application is submitted.
import { useCallback, useState } from "react";
import type { RegDraft } from "./Steps";

const KEY = "izgo_driver_reg_draft";
const EMPTY: RegDraft = { uploads: {} };

function read(): RegDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as RegDraft) : null;
    return v && typeof v === "object" && v.uploads ? v : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(d: RegDraft) {
  try {
    const uploads = Object.fromEntries(Object.entries(d.uploads).map(([k, u]) => [k, u && { ref: u.ref, name: u.name }]));
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, uploads }));
  } catch {
    /* not kept: the form still works */
  }
}

export function clearRegDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

export function useRegDraft(): [RegDraft, (fn: (d: RegDraft) => RegDraft) => void, () => void] {
  const [draft, setDraft] = useState<RegDraft>(read);
  const update = useCallback((fn: (d: RegDraft) => RegDraft) => {
    setDraft((d) => {
      const next = fn(d);
      write(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    clearRegDraft();
    setDraft(EMPTY);
  }, []);
  return [draft, update, reset];
}
