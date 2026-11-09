import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";
import { api } from "@/api/client";
import type { WalletEntry, WalletSummary } from "@/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { formatSom, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<WalletEntry["type"], string> = {
  cash: "Naqd to'lov",
  card: "Karta to'lovi",
  commission: "Komissiya",
  topup: "Hamyon to'ldirish",
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
            <div className="mb-4 h-36 w-full animate-pulse rounded-3xl bg-card" />
            <SkeletonList count={4} />
          </>
        )}

        {state === "error" && <ErrorState onRetry={load} />}

        {state === "ready" && wallet && (
          <>
            <Card
              className={cn(
                "mb-4 space-y-3 p-5",
                wallet.debtBlocked && "bg-danger/10 shadow-none"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-ink/60">
                  <WalletIcon className="h-4 w-4" /> Balans
                </span>
                <Badge tone="info">Komissiya {wallet.commissionPct}%</Badge>
              </div>
              <p className={cn("text-xl font-semibold tabular", wallet.balance < 0 ? "text-danger" : "text-ink")}>
                {formatSom(wallet.balance)}
              </p>
              {wallet.debtBlocked && (
                <div className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p className="text-xs font-medium text-danger">
                    Balans limitdan past. Yangi buyurtmalarni qabul qilish uchun hamyonni to'ldiring.
                  </p>
                </div>
              )}
              <Button fullWidth onClick={() => navigate("/wallet/topup")}>
                Hamyonni to'ldirish
              </Button>
            </Card>

            <p className="mb-2 px-1 text-sm font-semibold text-ink">Tranzaksiyalar</p>
            {wallet.entries.length === 0 ? (
              <EmptyState
                icon={<WalletIcon className="h-7 w-7" />}
                title="Tranzaksiyalar yo'q"
                description="Birinchi safaringizdan so'ng bu yerda tarix ko'rinadi."
              />
            ) : (
              <div className="space-y-2">
                {wallet.entries.map((e) => {
                  const positive = e.amount >= 0;
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-softer">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          positive ? "bg-accent-10 text-accent" : "bg-danger/10 text-danger"
                        )}
                      >
                        {positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{TYPE_LABEL[e.type]}</p>
                        <p className="text-xs text-ink/60">{formatRelativeDay(e.createdAt)}</p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular", positive ? "text-ink" : "text-danger")}>
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
      <BottomNav />
    </div>
  );
}
