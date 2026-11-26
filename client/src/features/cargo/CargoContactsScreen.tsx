import { useId, type ReactNode } from "react";
import type { CargoContact, Profile, Rider } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { formatPhoneInput } from "@/lib/phone";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, SectionLabel, Steps, TextAreaField, TextButton } from "@/ui";

/** One row of a contact box: small caps label over a 15px value. */
function ContactRow({
  label,
  value,
  onChange,
  error,
  prefix,
  divider,
  readOnly,
  ...input
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  error?: string;
  prefix?: string;
  divider?: boolean;
  readOnly?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex min-h-[58px] cursor-text flex-col justify-center gap-px py-1.5", divider && "border-b border-iz-divider-in-field")}>
      <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        {prefix && <span className="shrink-0 text-[15px] font-extrabold text-iz-ink">{prefix}</span>}
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "iz-input h-[22px] w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-extrabold outline-none placeholder:font-semibold placeholder:text-iz-muted placeholder:opacity-70",
            readOnly ? "text-iz-muted" : "text-iz-ink"
          )}
          {...input}
        />
      </span>
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-iz-danger">
          {error}
        </span>
      )}
    </label>
  );
}

function ContactBox({ children, invalid }: { children: ReactNode; invalid?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[22px] border-2 bg-iz-field px-4 focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
        invalid ? "border-iz-danger" : "border-transparent"
      )}
    >
      {children}
    </div>
  );
}

export type ContactIssues = Partial<Record<"sender.name" | "sender.phone" | "receiver.name" | "receiver.phone", string>>;

/**
 * Delivery, step 2 (design: CargoContacts / KbCargoContacts): sender (me by
 * default, or someone else), receiver, the receiver's address details and a
 * note about the cargo. With the keyboard up only the box being typed in
 * and the button stay.
 */
export function CargoContactsScreen({
  stepNames,
  current,
  profile,
  sender,
  receiver,
  note,
  issues,
  checking,
  onSender,
  onReceiver,
  onNote,
  onReceiverDetails,
  receiverDetailsSummary,
  onNext,
  onBack,
}: {
  stepNames: string[];
  current: number;
  profile: Profile | null;
  sender: Rider;
  receiver: CargoContact;
  note: string;
  issues: ContactIssues;
  checking: boolean;
  onSender: (r: Rider) => void;
  onReceiver: (c: CargoContact) => void;
  onNote: (v: string) => void;
  onReceiverDetails?: () => void;
  receiverDetailsSummary?: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const senderOther = sender.kind === "other";
  return (
    <Screen
      title={t("kargo.contacts.title")}
      onBack={onBack}
      top={<Steps steps={stepNames} current={current} label={t("trip.steps")} />}
      bodyClassName="gap-2.5 pt-5"
      footer={
        <PrimaryButton loading={checking} onClick={onNext}>
          {t("trip.continue")}
        </PrimaryButton>
      }
    >
      <div className="kb-collapse flex flex-col gap-2.5">
        <div className="flex items-center justify-between kb:hidden">
          <SectionLabel>{t("cargo.v2.sender")}</SectionLabel>
          <TextButton
            tone="green"
            className="-my-2 h-9"
            onClick={() => onSender(senderOther ? { kind: "me" } : { kind: "other", name: "", phone: "" })}
          >
            {senderOther ? t("cargo.v2.senderMe") : t("cargo.v2.senderOther")}
          </TextButton>
        </div>
        <ContactBox invalid={!!(issues["sender.name"] || issues["sender.phone"])}>
          {senderOther ? (
            <>
              <ContactRow
                label={t("cargo.v2.name")}
                value={sender.name}
                autoComplete="name"
                error={issues["sender.name"]}
                divider
                onChange={(v) => onSender({ ...sender, name: v })}
              />
              <ContactRow
                label={t("cargo.v2.phone")}
                prefix="+998"
                value={sender.phone}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="90 123 45 67"
                error={issues["sender.phone"]}
                onChange={(v) => onSender({ ...sender, phone: formatPhoneInput(v) })}
              />
            </>
          ) : (
            <>
              <ContactRow label={t("cargo.v2.name")} value={profile?.name ?? "—"} readOnly divider />
              <ContactRow label={t("cargo.v2.phone")} value={profile?.phoneMasked ?? "—"} readOnly />
            </>
          )}
        </ContactBox>
      </div>

      <div className="kb-collapse flex flex-col gap-2.5">
        <SectionLabel className="mt-1 kb:hidden">{t("cargo.v2.receiver")}</SectionLabel>
        <ContactBox invalid={!!(issues["receiver.name"] || issues["receiver.phone"])}>
          <ContactRow
            label={t("cargo.v2.name")}
            value={receiver.name}
            autoComplete="off"
            error={issues["receiver.name"]}
            divider
            onChange={(v) => onReceiver({ ...receiver, name: v })}
          />
          <ContactRow
            label={t("cargo.v2.phone")}
            prefix="+998"
            value={receiver.phone}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="90 123 45 67"
            error={issues["receiver.phone"]}
            onChange={(v) => onReceiver({ ...receiver, phone: formatPhoneInput(v) })}
          />
        </ContactBox>
        <p className="px-1 text-[12px] text-iz-muted kb:hidden">{t("kargo.receiverNote")}</p>
      </div>

      {onReceiverDetails && (
        <button type="button" onClick={onReceiverDetails} className="flex h-16 shrink-0 items-center gap-3.5 rounded-iz-field border border-iz-border px-3.5 text-left active:bg-iz-field kb:hidden">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-iz-field text-iz-ink">
            <Icon name="building" size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[14px] font-extrabold text-iz-ink">{t("cargo.v2.receiverAddress")}</span>
            <span className="truncate text-[12px] text-iz-muted">{receiverDetailsSummary || t("cargo.v2.receiverAddressHint")}</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-iz-muted" />
        </button>
      )}

      <div className="kb-collapse">
        <TextAreaField label={t("cargo.v2.note")} placeholder={t("cargo.v2.notePlaceholder")} value={note} onChange={(e) => onNote(e.target.value)} />
      </div>
    </Screen>
  );
}
