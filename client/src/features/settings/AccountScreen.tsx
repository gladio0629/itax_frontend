import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { AccountSummary, Profile } from "@/api/types";
import { ReviewStatus } from "@/components/ReviewStatus";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatPhoneInput } from "@/lib/phone";
import { serverErrorKey } from "@/lib/apiError";
import { BottomSheet, DangerButton, Field, Icon, IconButton, Initials, PrimaryButton, Screen, SectionLabel, StateError, StateLoading, TextButton } from "@/ui";
import { PhoneChangeSheet } from "./PhoneChangeSheet";

type Sheet = { kind: "add" } | { kind: "phone" } | { kind: "remove"; account: AccountSummary } | { kind: "deleteSelf" } | null;

/**
 * Akkaunt (design v2: Account / KbAccount): first and last name, the phone
 * (changed by SMS), other accounts on this device (switch, remove, add) and
 * deleting the account. With the keyboard up the big avatar moves into the
 * header and the sheet starts with the fields.
 */
export function AccountScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const caps = api.capabilities;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");

  function names(p: Profile) {
    if (p.firstName !== undefined || p.lastName !== undefined) return [p.firstName ?? "", p.lastName ?? ""];
    const [f, ...rest] = p.name.split(" ");
    return [f ?? "", rest.join(" ")];
  }

  function load() {
    setLoadError(false);
    api
      .getProfile()
      .then((p) => {
        setProfile(p);
        const [f, l] = names(p);
        setFirstName(f);
        setLastName(l);
      })
      .catch(() => setLoadError(true));
    if (caps.accounts) api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
  }
  useEffect(load, []);

  const [origFirst, origLast] = profile ? names(profile) : ["", ""];
  const changed = firstName.trim() !== origFirst || lastName.trim() !== origLast;

  async function saveName() {
    setSaving(true);
    setSaveError(null);
    try {
      const p = await api.updateProfileName(firstName.trim(), lastName.trim());
      setProfile(p);
      setSaved(true);
    } catch (e) {
      setSaveError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
    } finally {
      setSaving(false);
    }
  }

  function closeSheet() {
    setSheet(null);
    setReviewId(null);
    setSheetError(null);
    setAddName("");
    setAddPhone("");
  }

  async function run(action: () => Promise<{ id: string }>) {
    setBusy(true);
    setSheetError(null);
    try {
      setReviewId((await action()).id);
    } catch (e) {
      setSheetError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(id: string) {
    try {
      setAccounts(await api.switchAccount(id));
      load();
    } catch {
      setSaveError(t("common.errorMessage"));
    }
  }

  if (!profile) {
    return (
      <Screen title={t("settings.account")}>{loadError ? <StateError onRetry={load} /> : <StateLoading rows={3} />}</Screen>
    );
  }

  const others = accounts.filter((a) => !a.active);
  const addValid = addName.trim() !== "" && addPhone.replace(/\D/g, "").length === 9;

  return (
    <Screen
      title={t("settings.account")}
      headerRight={
        <>
          {/* Keyboard up (KbAccount): the avatar sits here instead. */}
          <span className="hidden kb:inline-flex">
            <Initials name={profile.name} size={44} />
          </span>
          <span className="kb:hidden">
            {caps.accounts ? <IconButton icon="userPlus" label={t("account.addAccount")} onClick={() => setSheet({ kind: "add" })} /> : <span className="block h-11 w-11" aria-hidden />}
          </span>
        </>
      }
      // Room for the avatar over the sheet edge (design: 60px under the header).
      top={<span aria-hidden className="block h-4" />}
      sheetOverlap={
        <div className="pointer-events-none absolute left-1/2 top-[-44px] -ml-[46px] rounded-full border-[5px] border-iz-sheet kb:hidden">
          <Initials name={profile.name} size={82} />
        </div>
      }
      bodyClassName="gap-3 !pt-16 kb:!pt-5"
      footer={
        <>
          {saveError && (
            <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
              {saveError}
            </p>
          )}
          {saved && !changed && (
            <p role="status" className="pb-1 text-[13px] font-semibold text-iz-green-text">
              {t("account.saved")}
            </p>
          )}
          <PrimaryButton loading={saving} disabled={!changed || !firstName.trim()} onClick={saveName}>
            {t("common.save")}
          </PrimaryButton>
          {caps.accountDeletion && (
            <TextButton tone="danger" className="kb:hidden" onClick={() => setSheet({ kind: "deleteSelf" })}>
              {t("account.deleteAccount")}
            </TextButton>
          )}
        </>
      }
    >
      <Field
        label={t("account.firstName")}
        icon="user"
        name="given-name"
        autoComplete="given-name"
        value={firstName}
        onChange={(e) => {
          setFirstName(e.target.value);
          setSaved(false);
          setSaveError(null);
        }}
      />
      <Field
        label={t("account.lastName")}
        icon="user"
        name="family-name"
        autoComplete="family-name"
        value={lastName}
        onChange={(e) => {
          setLastName(e.target.value);
          setSaved(false);
          setSaveError(null);
        }}
      />
      <Field
        label={t("account.phone")}
        icon="phone"
        type="tel"
        readOnly
        value={profile.phoneMasked}
        trailing={
          caps.phoneChange ? (
            <button
              type="button"
              onClick={() => setSheet({ kind: "phone" })}
              className="flex h-11 shrink-0 items-center px-1 text-[13px] font-extrabold text-iz-green-text"
            >
              {t("pay.change")}
            </button>
          ) : undefined
        }
      />

      {others.length > 0 && (
        <section className="mt-2 flex flex-col kb:hidden" aria-labelledby="acc-others">
          <SectionLabel id="acc-others" as="h2">
            {t("account.accountsTitle")}
          </SectionLabel>
          {others.map((a, i) => (
            <div key={a.id} className={i < others.length - 1 ? "flex items-center gap-2 border-b border-iz-border" : "flex items-center gap-2"}>
              <button type="button" onClick={() => switchTo(a.id)} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3.5 text-left active:opacity-70" aria-label={t("account.switchTo", { name: a.name })}>
                <Initials name={a.name} size={44} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold text-iz-ink">{a.name}</span>
                  <span className="text-[13px] text-iz-muted">{a.phoneMasked}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSheet({ kind: "remove", account: a })}
                aria-label={t("account.removeNamed", { name: a.name })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-danger active:bg-iz-danger-soft"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </section>
      )}

      {sheet?.kind === "phone" && (
        <PhoneChangeSheet
          onClose={closeSheet}
          onDone={() => {
            closeSheet();
            load();
          }}
        />
      )}

      {sheet?.kind === "add" && (
        <BottomSheet
          open
          onClose={closeSheet}
          title={t("account.addAccount")}
          closeLabel={t("common.close")}
          footer={
            reviewId ? undefined : (
              <>
                {sheetError && (
                  <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                    {sheetError}
                  </p>
                )}
                <PrimaryButton loading={busy} disabled={!addValid} onClick={() => run(() => api.addAccount({ name: addName.trim(), phone: `+998 ${addPhone}` }))}>
                  {t("common.confirm")}
                </PrimaryButton>
              </>
            )
          }
        >
          {reviewId ? (
            <ReviewStatus
              reviewId={reviewId}
              onApproved={() => {
                closeSheet();
                load();
              }}
              onRejected={() => setReviewId(null)}
            />
          ) : (
            <>
              <Field label={t("account.firstName")} icon="user" name="name" autoComplete="name" value={addName} onChange={(e) => setAddName(e.target.value)} />
              <Field
                label={t("account.newPhone")}
                icon="phone"
                type="tel"
                name="phone"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="90 123 45 67"
                prefix="+998"
                value={addPhone}
                onChange={(e) => setAddPhone(formatPhoneInput(e.target.value))}
              />
            </>
          )}
        </BottomSheet>
      )}

      {(sheet?.kind === "remove" || sheet?.kind === "deleteSelf") && (
        <BottomSheet
          open
          onClose={closeSheet}
          title={sheet.kind === "remove" ? t("account.deleteAccount") : t("account.deleteSelfAction")}
          closeLabel={t("common.close")}
          footer={
            reviewId ? undefined : (
              <>
                {sheetError && (
                  <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                    {sheetError}
                  </p>
                )}
                <DangerButton
                  loading={busy}
                  onClick={() => run(() => (sheet.kind === "remove" ? api.deleteAccount(sheet.account.id) : api.requestAccountDeletion()))}
                >
                  {t("account.deleteConfirmButton")}
                </DangerButton>
                <TextButton onClick={closeSheet}>{t("common.cancel")}</TextButton>
              </>
            )
          }
        >
          {reviewId ? (
            <ReviewStatus
              reviewId={reviewId}
              title={sheet.kind === "deleteSelf" ? t("account.deleteRequestedTitle") : undefined}
              description={sheet.kind === "deleteSelf" ? t("account.deleteRequestedDesc") : undefined}
              onApproved={() => {
                if (sheet.kind === "deleteSelf") {
                  logout();
                  navigate("/auth/phone", { replace: true });
                  return;
                }
                closeSheet();
                load();
              }}
              onRejected={() => setReviewId(null)}
            />
          ) : (
            <p className="text-[15px] leading-[22px] text-iz-ink">
              {sheet.kind === "remove" ? t("account.deleteAccountConfirm", { name: sheet.account.name }) : t("account.deleteSelfFullWarning")}
            </p>
          )}
        </BottomSheet>
      )}
    </Screen>
  );
}
