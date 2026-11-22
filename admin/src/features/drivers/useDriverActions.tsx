import { useState } from "react";
import { api } from "@/api/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormDrawer } from "@/components/FormDrawer";
import { Input } from "@/components/Input";
import { Toast } from "@/components/Toast";
import type { Driver } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; driver: Pick<Driver, "id" | "name"> };

/**
 * Driver actions shared by the list's row menu and the profile page:
 * edit (name; car only when the backend can), block with a reason,
 * unblock, archive, restore. No manual approval (doc 2.3).
 */
export function useDriverActions(onChanged: (d: Driver) => void) {
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: "", carModel: "", carColor: "", plate: "" });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function edit(d: Driver) {
    setForm({ name: d.name, carModel: d.carModel, carColor: d.carColor, plate: d.plate });
    setError(null);
    setEditing(d);
  }
  function ask(type: Confirm["type"], driver: Confirm["driver"]) {
    setError(null);
    setConfirm({ type, driver });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      // Car fields go only to a backend that can change them.
      const updated = await api.updateDriverProfile(editing.id, caps.driverCarEdit ? form : { name: form.name });
      setEditing(null);
      setToast("Profil saqlandi");
      onChanged(updated);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function run(reason?: string) {
    if (!confirm) return;
    setActing(true);
    setError(null);
    try {
      const { type, driver } = confirm;
      const updated =
        type === "block"
          ? await api.setDriverStatus(driver.id, "blocked", reason)
          : type === "unblock"
            ? await api.setDriverStatus(driver.id, "active")
            : type === "archive"
              ? await api.archiveDriver(driver.id)
              : await api.restoreDriver(driver.id);
      setToast(type === "block" ? "Bloklandi" : type === "unblock" ? "Blokdan chiqarildi" : type === "archive" ? "Arxivlandi" : "Tiklandi");
      setConfirm(null);
      onChanged(updated);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  const copy: Record<Confirm["type"], { title: string; text: string; label: string; tone: "danger" | "accent" }> = {
    block: { title: "Haydovchini bloklash", text: "yangi so'rovlarni ko'rmaydi va qabul qila olmaydi.", label: "Bloklash", tone: "danger" },
    unblock: { title: "Blokdan chiqarish", text: "yana so'rovlarni ko'ra oladi.", label: "Blokdan chiqarish", tone: "accent" },
    archive: { title: "Arxivlash", text: "ro'yxatdan yashiriladi. Keyin tiklash mumkin.", label: "Arxivlash", tone: "danger" },
    restore: { title: "Tiklash", text: "arxivdan qaytariladi.", label: "Tiklash", tone: "accent" },
  };
  const c = confirm ? copy[confirm.type] : null;

  const elements = (
    <>
      <FormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Haydovchini tahrirlash"
        onSubmit={save}
        loading={saving}
        disabled={!form.name.trim()}
        error={editing ? error : null}
      >
        <Input label="Ism familiya" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        {caps.driverCarEdit ? (
          <>
            <Input label="Mashina modeli" value={form.carModel} onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))} />
            <Input label="Rangi" value={form.carColor} onChange={(e) => setForm((f) => ({ ...f, carColor: e.target.value }))} />
            <Input label="Davlat raqami" value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} />
          </>
        ) : (
          <p className="px-1 text-xs font-medium text-muted">Mashina ma'lumotlarini hozircha faqat haydovchi o'zgartira oladi.</p>
        )}
      </FormDrawer>
      <ConfirmDialog
        open={!!confirm}
        title={c?.title ?? ""}
        description={confirm && c ? `${confirm.driver.name} ${c.text}` : ""}
        confirmLabel={c?.label}
        tone={c?.tone}
        loading={acting}
        reasonLabel={confirm?.type === "block" ? "Bloklash sababi (majburiy)" : undefined}
        error={confirm ? error : null}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );

  return { edit, ask, elements };
}
