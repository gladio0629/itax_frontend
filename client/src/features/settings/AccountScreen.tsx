import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2, AlertTriangle } from "@/lib/icons";
import { api } from "@/api/client";
import type { AccountSummary, Profile } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Sheet } from "@/components/Sheet";
import { ReviewStatus } from "@/components/ReviewStatus";
import { SkeletonCard } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import { PhoneChangeSheet } from "./PhoneChangeSheet";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

export function AccountScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [phoneSheetOpen, setPhoneSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addReviewId, setAddReviewId] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountSummary | null>(null);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [selfDeleteOpen, setSelfDeleteOpen] = useState(false);
  const [selfDeleteReviewId, setSelfDeleteReviewId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    api.getProfile().then((p) => {
      setProfile(p);
      const [f, ...rest] = p.name.split(" ");
      setFirstName(f ?? "");
      setLastName(rest.join(" "));
    }).catch(() => setLoadError(true));
    api.getAccounts().then(setAccounts).catch(() => setLoadError(true));
  }

  useEffect(load, []);

  async function saveName() {
    setSavingName(true);
    try {
      const p = await api.updateProfileName(firstName, lastName);
      setProfile(p);
      setEditing(false);
      load();
    } finally {
      setSavingName(false);
    }
  }

  async function switchAccount(id: string) {
    const next = await api.switchAccount(id);
    setAccounts(next);
  }

  async function submitAddAccount() {
    if (!addName.trim() || addPhone.replace(/\D/g, "").length !== 9) return;
    setAddSubmitting(true);
    try {
      const review = await api.addAccount({ name: addName.trim(), phone: `+998 ${addPhone}` });
      setAddReviewId(review.id);
    } finally {
      setAddSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const review = await api.deleteAccount(deleteTarget.id);
    setDeleteReviewId(review.id);
  }

  async function confirmSelfDelete() {
    const review = await api.requestAccountDeletion();
    setSelfDeleteReviewId(review.id);
  }

  if (!profile) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("settings.account")} />
        {loadError ? <ErrorState onRetry={load} /> : <div className="px-4 pt-4"><SkeletonCard /></div>}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={t("settings.account")} />
      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4">
        <Card className="mb-5 p-5">
          <div className={`flex items-center gap-4 ${editing ? "mb-4" : ""}`}>
            <Avatar seed={profile.avatarSeed} name={profile.name} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink">{profile.name}</p>
              <p className="text-xs text-ink/60">{profile.phoneMasked}</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                aria-label={t("account.edit")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {editing && (
            <div className="space-y-3 border-t border-border pt-4">
              <Input label={t("account.firstName")} name="given-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label={t("account.lastName")} name="family-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <button
                onClick={() => setPhoneSheetOpen(true)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-dashed border-accent/40 px-4 py-3 text-xs font-semibold text-accent"
              >
                {t("account.changePhone")}
              </button>
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" fullWidth onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button fullWidth loading={savingName} onClick={saveName}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* The active account is the card above — this list is the other
            accounts only, so nothing here duplicates it. */}
        {accounts.some((a) => !a.active) && (
          <>
            <p className="mb-2 px-1 text-xs font-semibold text-ink/60">{t("account.accountsTitle")}</p>
            <Card className="mb-5 divide-y divide-border" padded={false}>
              {accounts
                .filter((a) => !a.active)
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-4">
                    <Avatar seed={a.avatarSeed} name={a.name} size={40} />
                    <button onClick={() => switchAccount(a.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                      <p className="text-xs text-ink/60">{a.phoneMasked}</p>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(a)}
                      aria-label={t("account.deleteAccount")}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </Card>
          </>
        )}
        <button
          onClick={() => setAddOpen(true)}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left text-accent shadow-softer"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-5">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">{t("account.addAccount")}</span>
        </button>

        <p className="mb-2 px-1 text-xs font-semibold text-danger">{t("account.dangerZone")}</p>
        <Card className="p-4">
          <p className="mb-3 text-xs text-ink/60">{t("account.deleteSelfWarning")}</p>
          <Button variant="danger" fullWidth onClick={() => setSelfDeleteOpen(true)}>
            {t("account.deleteSelfAction")}
          </Button>
        </Card>
      </div>

      {phoneSheetOpen && (
        <PhoneChangeSheet
          onClose={() => setPhoneSheetOpen(false)}
          onDone={() => {
            setPhoneSheetOpen(false);
            load();
          }}
        />
      )}

      {addOpen && (
        <Sheet open onClose={() => setAddOpen(false)} ariaLabel={t("account.addAccount")}>
          <div className="px-5 pb-6 pt-3">
            {addReviewId ? (
              <ReviewStatus
                reviewId={addReviewId}
                onApproved={() => {
                  setAddOpen(false);
                  setAddReviewId(null);
                  setAddName("");
                  setAddPhone("");
                  load();
                }}
              />
            ) : (
              <>
                <h2 className="mb-4 text-sm font-semibold text-ink">{t("account.addAccount")}</h2>
                <div className="space-y-3">
                  <Input label={t("account.firstName")} name="name" autoComplete="name" value={addName} onChange={(e) => setAddName(e.target.value)} />
                  <Input
                    label={t("account.newPhone")}
                    type="tel"
                    name="phone"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    placeholder="90 123 45 67"
                    value={addPhone}
                    onChange={(e) => setAddPhone(formatPhoneInput(e.target.value))}
                    leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
                  />
                </div>
                <div className="mt-5">
                  <Button fullWidth loading={addSubmitting} onClick={submitAddAccount}>
                    {t("common.confirm")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Sheet>
      )}

      {deleteTarget && (
        <Sheet open onClose={() => { setDeleteTarget(null); setDeleteReviewId(null); }} ariaLabel={t("account.deleteAccount")}>
          <div className="px-5 pb-6 pt-3">
            {deleteReviewId ? (
              <ReviewStatus
                reviewId={deleteReviewId}
                onApproved={() => {
                  setDeleteTarget(null);
                  setDeleteReviewId(null);
                  load();
                }}
              />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="text-sm font-semibold">{t("account.deleteAccount")}</h2>
                </div>
                <p className="mb-5 text-sm text-ink/70">{t("account.deleteAccountConfirm", { name: deleteTarget.name })}</p>
                <Button variant="danger" fullWidth onClick={confirmDelete}>
                  {t("common.confirm")}
                </Button>
              </>
            )}
          </div>
        </Sheet>
      )}

      {selfDeleteOpen && (
        <Sheet open onClose={() => { setSelfDeleteOpen(false); setSelfDeleteReviewId(null); }} ariaLabel={t("account.deleteSelfAction")}>
          <div className="px-5 pb-6 pt-3">
            {selfDeleteReviewId ? (
              <ReviewStatus
                reviewId={selfDeleteReviewId}
                title={t("account.deleteRequestedTitle")}
                description={t("account.deleteRequestedDesc")}
                onApproved={() => {
                  logout();
                  navigate("/auth/phone", { replace: true });
                }}
              />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="text-sm font-semibold">{t("account.deleteSelfAction")}</h2>
                </div>
                <p className="mb-5 text-sm text-ink/70">{t("account.deleteSelfFullWarning")}</p>
                <Button variant="danger" fullWidth onClick={confirmSelfDelete}>
                  {t("common.confirm")}
                </Button>
              </>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
