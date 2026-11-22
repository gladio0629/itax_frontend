// Sign-in and registration (redesign v2): Main → Otp → personal → licence →
// car → selfie → automatic check → Yo'nalishlarim (first run). The server's
// session stage decides the step; going back opens an earlier step to edit.
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Session, SessionStage } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useSession } from "@/stores/sessionStore";
import { Lock } from "@/lib/icons";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { StateBlock } from "@/components/StateBlock";
import { ErrorState } from "@/components/ErrorState";
import { RouteFallback } from "@/components/RouteFallback";
import { RoutesEditor } from "@/features/routes/RoutesEditor";
import { SignIn } from "./SignIn";
import { CarStep, LicenseStep, PersonalStep, SelfieStep } from "./Steps";
import { ReviewStep } from "./ReviewStep";
import { FormNotice, RegShell } from "./parts";
import { useRegDraft } from "./draftStore";

const FORM_STEPS = ["personal", "license", "car", "selfie"] as const;
type FormStep = (typeof FORM_STEPS)[number];
const isFormStep = (s: SessionStage): s is FormStep => (FORM_STEPS as readonly string[]).includes(s);

export default function RegistrationFlow() {
  const { t } = useT();
  const session = useSession((s) => s.session);
  const setSession = useSession((s) => s.set);
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();
  const options = useQuery(() => api.getRegistrationOptions(), [session?.stage === "signed_out"]);
  const [draft, setDraft, resetDraft] = useRegDraft();
  /** An earlier step opened with "back" (null: the server's step). */
  const [editing, setEditing] = useState<FormStep | null>(null);
  /** Keep the review screen up after approval until the driver taps "Bosh sahifaga". */
  const [approved, setApproved] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Submitted (or signed out): the typed data is no longer needed on the phone.
  const stage = session?.stage;
  useEffect(() => {
    if (stage === "review" || stage === "signed_out") resetDraft();
  }, [stage, resetDraft]);

  if (!session) return null;
  if (session.stage === "active" && !approved) return <Navigate to="/" replace />;

  const saved = (s: Session) => {
    setEditing(null);
    setSession(s);
  };

  async function logout() {
    setLoggingOut(true);
    try {
      setSession(await api.logout());
      resetDraft();
      setEditing(null);
      setLogoutOpen(false);
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setLoggingOut(false);
    }
  }

  if (session.stage === "signed_out") return <SignIn onVerified={() => refresh()} />;
  if (session.stage === "blocked") return <Blocked onLogout={logout} busy={loggingOut} />;

  if (session.stage === "review" || approved) {
    return (
      <ReviewStep
        reviewId={session.documentsReviewId}
        onApproved={() => {
          setApproved(true);
          refresh().catch(() => {});
        }}
        onRejected={() => refresh().catch(() => {})}
        onContinue={() => {
          setApproved(false);
          if (session.stage !== "routes") navigate("/", { replace: true });
        }}
      />
    );
  }

  if (session.stage === "routes") return <RoutesStep onDone={(next) => (setSession(next), navigate("/", { replace: true }))} />;

  if (!isFormStep(session.stage)) return <RouteFallback />;
  if (options.error && !options.data) {
    return (
      <div className="flex h-full items-center bg-bg px-6">
        <ErrorState error={options.error} onRetry={() => options.reload()} />
      </div>
    );
  }
  if (!options.data) return <RouteFallback />;

  const step: FormStep = editing ?? session.stage;
  const idx = FORM_STEPS.indexOf(step);
  const back = () => (idx === 0 ? setLogoutOpen(true) : setEditing(FORM_STEPS[idx - 1]));
  const props = { options: options.data, draft, setDraft, onSaved: saved, onBack: back };
  const notice = session.notice === "rejected" ? <FormNotice>{t("reg.rejectedNotice")}</FormNotice> : undefined;

  return (
    <>
      {step === "personal" ? (
        <PersonalStep {...props} notice={notice} />
      ) : step === "license" ? (
        <LicenseStep {...props} />
      ) : step === "car" ? (
        <CarStep {...props} />
      ) : (
        <SelfieStep {...props} />
      )}
      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title={t("profile.logoutTitle")}>
        <p className="mb-5 text-sm text-muted">{t("reg.logoutDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={loggingOut} onClick={logout}>
            {t("profile.logout")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

// ---------- Yo'nalishlarim (first run, after approval) ----------

function RoutesStep({ onDone }: { onDone: (s: Session) => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  async function finish() {
    setBusy(true);
    try {
      onDone(await api.completeRoutesSetup());
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <RegShell
      title={t("routes.setupTitle")}
      desc={t("routes.setupDesc")}
      footer={
        <Button size="lg" fullWidth loading={busy} onClick={finish}>
          {t("routes.setupDone")}
        </Button>
      }
    >
      <RoutesEditor />
    </RegShell>
  );
}

/** The server says the account is blocked: nothing to do here but sign out. */
function Blocked({ onLogout, busy }: { onLogout: () => void; busy: boolean }) {
  const { t } = useT();
  return (
    <Screen
      title=""
      footer={
        <Button size="lg" variant="dark" fullWidth loading={busy} onClick={onLogout} trailing={null}>
          {t("profile.logout")}
        </Button>
      }
    >
      <StateBlock role="alert" icon={Lock} tone="warning" title={t("reg.blockedTitle")} description={t("reg.blockedDesc")} />
    </Screen>
  );
}
