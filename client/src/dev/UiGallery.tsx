// Dev-only gallery of the design v2 kit (route /dev/ui, `npm run dev` only).
// Not part of any production build: routes.tsx loads it behind
// import.meta.env.DEV. Labels here are developer notes, not app copy.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/provider";
import {
  BottomSheet,
  Chip,
  DangerButton,
  Field,
  IconButton,
  ListRow,
  Logo,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  Stepper,
  Steps,
  Switch,
  TextAreaField,
  TextButton,
  Badge,
  Initials,
  Icon,
  useKeyboard,
  type IconName,
} from "@/ui";

const ICONS: IconName[] = [
  "back", "check", "arrowRight", "star", "chevronRight", "pin", "phone", "user", "close", "car", "search", "globe",
  "plus", "share", "locate", "support", "swap", "bell", "gift", "userPlus", "lock", "minus", "plusSmall", "wifiOff",
  "refresh", "calendar", "edit", "arrowDown", "arrowUp", "menu", "home", "briefcase", "clock", "building", "sliders",
  "cash", "tag", "megaphone", "luggage", "keypad", "doc", "shield", "chat", "alert", "moon", "info", "logout",
  "homeFilled", "seats", "chevronDown", "card", "box", "map", "starSharp",
];

type View = "kit" | "empty" | "error" | "loading" | "offline";

export default function UiGallery() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useT();
  const kb = useKeyboard();
  const [view, setView] = useState<View>("kit");
  const [mode, setMode] = useState<"now" | "exact" | "range">("range");
  const [chips, setChips] = useState<string[]>(["a"]);
  const [on, setOn] = useState(true);
  const [count, setCount] = useState(2);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("Aziz");
  const [note, setNote] = useState("");

  const toggle = (id: string) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="relative h-full">
      <Screen
        title="UI kit (dev)"
        onBack={() => navigate(-1)}
        backLabel={t("common.back")}
        headerRight={<IconButton icon="moon" label="theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />}
        top={
          <>
            <div className="flex items-center justify-between">
              <Logo />
              <Badge>{kb.open ? `kb ${kb.inset}px` : "kb closed"}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-iz-head-muted">Big number</span>
              <span className="text-[38px] font-extrabold leading-[46px] tabular-nums text-iz-head-text">
                08:00<span className="text-iz-green">–</span>12:00
              </span>
            </div>
            <Steps steps={["Safar", "To'lov", "Qidiruv"]} current={0} label="steps" />
          </>
        }
        footer={
          <>
            <PrimaryButton onClick={() => setSheet(true)}>Bottom sheet</PrimaryButton>
            <TextButton tone="danger">Text button</TextButton>
          </>
        }
      >
        {view !== "kit" ? (
          <>
            <Segmented label="view" value={view} onChange={setView} options={(["kit", "empty", "error", "loading", "offline"] as View[]).map((v) => ({ value: v, label: v }))} />
            {view === "empty" && <StateEmpty title="Hali safar yo'q" description="Birinchi safaringizdan keyin u shu yerda ko'rinadi." actionLabel="Safar buyurtma qilish" onAction={() => setView("kit")} />}
            {view === "error" && <StateError onRetry={() => setView("kit")} onHelp={() => setView("kit")} />}
            {view === "loading" && <StateLoading />}
          </>
        ) : (
          <>
            <Segmented label="view" value={view} onChange={setView} options={(["kit", "empty", "error", "loading", "offline"] as View[]).map((v) => ({ value: v, label: v }))} />
            <SectionLabel>Language / theme</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Segmented size="sm" label="locale" value={locale} onChange={setLocale} options={[{ value: "uz", label: "UZ" }, { value: "ru", label: "RU" }, { value: "en", label: "EN" }]} />
              <Segmented size="sm" label="theme" value={theme} onChange={setTheme} options={[{ value: "light", label: "Och" }, { value: "dark", label: "To'q" }]} />
            </div>
            <p className="text-[15px] font-semibold text-iz-ink">Ўзбек · Русский текст: съешь же ещё этих мягких булок · Oʻzbek gʻalla</p>

            <SectionLabel>Fields</SectionLabel>
            <Field label="Ism" icon="user" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Telefon" icon="phone" value="+998 90 *** ** 67" readOnly />
            <Field label="Podyezd" inputMode="numeric" placeholder="2" />
            <Field label="Promo kod" error="Kod topilmadi" defaultValue="IZGO" />
            <TextAreaField label="Haydovchiga izoh" placeholder="Masalan, bagaj ko'p" counter="0 / 200" />

            <SectionLabel>Segmented / chips / switch / stepper</SectionLabel>
            <Segmented label="time" value={mode} onChange={setMode} options={[{ value: "now", label: "Hozir" }, { value: "exact", label: "Aniq vaqt" }, { value: "range", label: "Oraliq" }]} />
            <div className="flex flex-wrap gap-2">
              {["a", "b", "c", "d"].map((id, i) => (
                <Chip key={id} selected={chips.includes(id)} onClick={() => toggle(id)}>
                  {["Hush muomala", "Yaxshi suhbatdosh", "Komfort", "Shunchaki"][i]}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["Yo'q", "5 000", "10 000", "Boshqa"].map((x, i) => (
                <Chip key={x} compact selected={i === 0} onClick={() => undefined}>
                  {x}
                </Chip>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Switch checked={on} onChange={setOn} label="switch" />
              <Switch checked={!on} onChange={(v) => setOn(!v)} label="switch 2" />
              <Stepper value={count} onChange={setCount} min={0} max={4} decLabel="-" incLabel="+" />
            </div>
            <div className="flex items-center gap-3 rounded-iz-card bg-iz-head p-4">
              <Switch tone="head" checked={on} onChange={setOn} label="switch head" />
              <Initials name="Aziz Karimov" />
              <Badge tone="warn">warn</Badge>
              <Badge tone="danger">danger</Badge>
            </div>

            <SectionLabel>Rows</SectionLabel>
            <div className="flex flex-col">
              <ListRow icon="bell" title="Bildirishnomalar" onClick={() => undefined} />
              <ListRow icon="globe" title="Til" value="O'zbek" onClick={() => undefined} />
              <ListRow icon="megaphone" title="Yangiliklar" subtitle="Yangi yo'nalishlar va imkoniyatlar" trailing={<Switch checked={on} onChange={setOn} label="news" />} last />
            </div>
            <DangerButton icon="logout">Chiqish</DangerButton>

            <SectionLabel>Icons</SectionLabel>
            <div className="grid grid-cols-8 gap-2 text-iz-ink">
              {ICONS.map((n) => (
                <span key={n} title={n} className="flex h-10 items-center justify-center rounded-xl bg-iz-field">
                  <Icon name={n} />
                </span>
              ))}
            </div>
          </>
        )}
      </Screen>
      {view === "offline" && <StateOffline onRetry={() => setView("kit")} />}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Bekor qilish sababi"
        closeLabel={t("common.close")}
        footer={<PrimaryButton onClick={() => setSheet(false)}>{t("common.confirm")}</PrimaryButton>}
      >
        <Field label="Izoh" placeholder="..." value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Chip selected onClick={() => undefined}>Rejam o'zgardi</Chip>
          <Chip selected={false} onClick={() => undefined}>Uzoq kutdim</Chip>
        </div>
      </BottomSheet>
    </div>
  );
}
