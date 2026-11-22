import { APP_VERSION, SITE_URL, SUPPORT_EMAIL } from "@/config";
import { useT } from "@/lib/i18n/provider";
import { Icon, Logo, Screen, type IconName } from "@/ui";

function LinkRow({ icon, title, href, value, last }: { icon: IconName; title: string; href?: string; value?: string; last?: boolean }) {
  const body = (
    <>
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-field text-iz-ink">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-iz-ink">{title}</span>
      {value && <span className="shrink-0 truncate text-[14px] font-extrabold text-iz-green-text">{value}</span>}
      {href && !value && <Icon name="chevronRight" size={18} className="shrink-0 text-iz-muted" />}
    </>
  );
  const cls = `flex min-h-[68px] shrink-0 items-center gap-3.5 ${last ? "" : "border-b border-iz-border"}`;
  // Pages on the public site open in the system browser.
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={`${cls} active:opacity-70`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Biz haqimizda (design v2: About): logo and the line about IZGO, terms,
 * privacy, the website, the support e-mail and the version.
 */
export function AboutScreen() {
  const { t } = useT();
  const host = SITE_URL ? SITE_URL.replace(/^https?:\/\//, "") : "";
  return (
    <Screen
      title={t("settings.about")}
      top={
        <div className="flex flex-col gap-4 pb-2 pt-6">
          <Logo width={150} />
          <p className="text-[17px] font-semibold leading-[26px] text-iz-head-soft">{t("about.description")}</p>
        </div>
      }
      bodyClassName="gap-0 pt-4"
    >
      <LinkRow icon="doc" title={t("about.terms")} href={SITE_URL ? `${SITE_URL}/terms` : undefined} />
      <LinkRow icon="lock" title={t("about.privacy")} href={SITE_URL ? `${SITE_URL}/privacy` : undefined} />
      {SITE_URL && <LinkRow icon="globe" title={t("about.website")} href={SITE_URL} value={host} />}
      <LinkRow icon="support" title={t("about.contact")} href={`mailto:${SUPPORT_EMAIL}`} value={SUPPORT_EMAIL} last />
      <span className="mt-3 text-center text-[12px] font-semibold text-iz-muted">{t("about.version", { version: APP_VERSION })}</span>
    </Screen>
  );
}
