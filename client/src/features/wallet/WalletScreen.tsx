// TODO(wallet): decision pending. Removed from routes/nav in Step 1 per
// spec — the passenger Wallet concept is superseded by Bonuslar (Step 3),
// but this file is kept in place (unreferenced) in case Wallet returns.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CreditCard, Gift, Wallet as WalletIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { PassengerWalletEntry, WalletSummary } from "@/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { formatSom, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<PassengerWalletEntry["type"], string> = {
  topup: "Hamyon to'ldirildi",
  trip_payment: "Safar uchun to'lov",
  refund: "Qaytarilgan to'lov",
  bonus: "Bonus",
};

const TYPE_ICON: Record<PassengerWalletEntry["type"], typeof ArrowDownLeft> = {
  topup: ArrowDownLeft,
  trip_payment: ArrowUpRight,
  refund: ArrowDownLeft,
  bonus: Gift,
};

type LoadState = "loading" | "error" | "ready";

export function WalletScreen() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  function load() {
    setState("loading");
    api
      .getWallet()
      .then((w) => {
        setWallet(w);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Hamyon</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {state === "loading" && (
          <>
            <div className="mb-4 h-32 w-full animate-pulse rounded-2xl bg-card" />
            <SkeletonList count={4} />
          </>
        )}

        {state === "error" && <ErrorState onRetry={load} />}

        {state === "ready" && wallet && (
          <>
            <Card className="mb-4 space-y-3 p-5">
              <span className="flex items-center gap-2 text-xs font-semibold text-ink/60">
                <WalletIcon className="h-4 w-4" /> Balans
              </span>
              <p className="text-xl font-semibold tabular text-ink">{formatSom(wallet.balance)}</p>

              {wallet.lowBalance && (
                <div className="flex items-start gap-2 rounded-xl bg-warning/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs font-normal text-warning">
                    Balans past. Karta orqali to'lashdan oldin hamyonni to'ldirishni unutmang.
                  </p>
                </div>
              )}

              <Button fullWidth onClick={() => navigate("/cards")}>
                <CreditCard className="h-4 w-4" /> Hamyonni to'ldirish
              </Button>
            </Card>

            <p className="mb-2 px-1 text-sm font-semibold text-ink">Tranzaksiyalar</p>
            {wallet.entries.length === 0 ? (
              <EmptyState
                icon={<WalletIcon className="h-7 w-7" />}
                title="Tranzaksiyalar yo'q"
                description="Karta orqali to'langan birinchi safaringizdan so'ng bu yerda tarix ko'rinadi."
                actionLabel="Buyurtma berish"
                onAction={() => navigate("/home")}
              />
            ) : (
              <div className="space-y-2">
                {wallet.entries.map((e) => {
                  const positive = e.amount >= 0;
                  const Icon = TYPE_ICON[e.type];
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-softer">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          positive ? "bg-accent-10 text-accent" : "bg-ink/5 text-ink/70"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-normal text-ink">{TYPE_LABEL[e.type]}</p>
                        <p className="text-xs text-ink/60">{formatRelativeDay(e.createdAt)}</p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular", positive ? "text-accent" : "text-ink")}>
                        {positive ? "+" : ""}
                        {formatSom(e.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
