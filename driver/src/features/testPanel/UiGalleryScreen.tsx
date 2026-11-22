// Sample-data mode only (routes.tsx loads it behind DEMO_MODE): the redesign
// v2 base components and states on one page, for review.
import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme";
import { Bell, Globe, LogOut, Moon, Package, Search, User, WifiOff } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip, Tag } from "@/components/Chip";
import { Card, SectionLabel } from "@/components/Card";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { Sheet } from "@/components/Sheet";
import { Money } from "@/components/Money";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { StateBlock } from "@/components/StateBlock";
import { TabBar } from "@/components/TabBar";
import { testPanelText } from "./strings";
import { TEST_PANEL_PATH } from "./paths";

export default function UiGalleryScreen() {
  const { t, locale } = useT();
  const { theme, toggleTheme } = useTheme();
  const [chip, setChip] = useState<"all" | "p" | "d">("all");
  const [sheet, setSheet] = useState(false);
  const [phone, setPhone] = useState("");

  return (
    <Screen
      title={testPanelText(locale, "uiGallery")}
      back={TEST_PANEL_PATH}
      right={
        <HeaderButton label={t("common.close")} onClick={() => {}}>
          <Bell className="h-5 w-5" />
        </HeaderButton>
      }
      top={
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-night-muted">{t("tab.wallet")}</span>
          <Money value={286000} className="text-4xl font-extrabold text-white" unitClassName="text-15 font-bold text-night-muted" />
        </div>
      }
    >
      <div className="flex flex-col gap-8 pb-10">
        <section className="flex flex-col gap-3">
          <SectionLabel>Button</SectionLabel>
          <Button size="lg" fullWidth>
            {t("common.continue")}
          </Button>
          <Button size="lg" fullWidth loading>
            {t("common.continue")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary">{t("feed.reject")}</Button>
            <Button>{t("feed.accept")}</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="dark">{t("common.save")}</Button>
            <Button variant="danger">{t("profile.logout")}</Button>
          </div>
          <Button size="lg" fullWidth disabled>
            {t("common.continue")}
          </Button>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>TextField</SectionLabel>
          <TextField label={t("reg.phone")} prefix="+998" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField label={t("personal.name")} defaultValue="Aziz" trailing={<User className="h-5 w-5 text-muted" />} />
          <TextField label={t("personal.plate")} defaultValue="01 A" error={t("error.PLATE_INVALID")} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Chip · Tag</SectionLabel>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <Chip selected={chip === "all"} onClick={() => setChip("all")}>
              {t("common.all")}
            </Chip>
            <Chip selected={chip === "p"} onClick={() => setChip("p")}>
              <User className="h-4 w-4" />
              {t("tab.profile")}
            </Chip>
            <Chip selected={chip === "d"} onClick={() => setChip("d")}>
              <Package className="h-4 w-4" />
              S · M · L
            </Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag tone="brand">{t("feed.accept")}</Tag>
            <Tag tone="night">3XL</Tag>
            <Tag>2 · {t("common.km")}</Tag>
            <Tag tone="danger">{t("feed.reject")}</Tag>
            <Tag tone="warning">{t("state.offlineBanner")}</Tag>
          </div>
        </section>

        <section>
          <SectionLabel>Card</SectionLabel>
          <div className="flex flex-col gap-3">
            <Card tone="selected" className="p-4">
              <Money value={260000} className="text-2xl font-extrabold text-ink" />
            </Card>
            <Card className="p-4 text-sm text-muted">{t("state.serverDesc")}</Card>
            <Card tone="soft" className="p-4 text-sm text-ink">{t("state.offlineDesc")}</Card>
          </div>
        </section>

        <SettingsGroup label="SettingsRow · Switch">
          <SettingsRow icon={Moon} label={t("profile.theme")} trailing={<Switch checked={theme === "dark"} onChange={toggleTheme} label={t("profile.theme")} />} />
          <SettingsRow icon={Globe} label={t("profile.language")} value="O'zbek" onClick={() => setSheet(true)} />
          <SettingsRow icon={LogOut} label={t("profile.logout")} danger onClick={() => {}} />
        </SettingsGroup>

        <section className="flex flex-col gap-3">
          <SectionLabel>Sheet</SectionLabel>
          <Button variant="secondary" fullWidth onClick={() => setSheet(true)}>
            Sheet
          </Button>
        </section>

        <section>
          <SectionLabel>Loading</SectionLabel>
          <SkeletonList label={t("common.loading")} />
        </section>
        <section>
          <SectionLabel>Empty</SectionLabel>
          <EmptyState icon={Search} title={t("orders.emptyHistoryTitle")} description={t("orders.emptyHistoryDesc")} />
        </section>
        <section>
          <SectionLabel>Error</SectionLabel>
          <ErrorState error={{ code: "generic" }} onRetry={() => {}} helpTo={TEST_PANEL_PATH} />
        </section>
        <section>
          <SectionLabel>Offline</SectionLabel>
          <StateBlock icon={WifiOff} title={t("state.offlineTitle")} description={t("state.offlineDesc")} />
        </section>
        <section>
          <SectionLabel>TabBar</SectionLabel>
          <div className="relative h-24 overflow-hidden rounded-card bg-raised" style={{ ["--tabbar-gap" as string]: "16px", ["--safe-bottom" as string]: "0px" }}>
            <TabBar badge={{ "/wallet": true, "/": 3 }} />
          </div>
        </section>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("profile.language")}>
        <p className="mb-5 text-sm text-muted">{t("state.offlineDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setSheet(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => setSheet(false)}>{t("common.done")}</Button>
        </div>
      </Sheet>
    </Screen>
  );
}
